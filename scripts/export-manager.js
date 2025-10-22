/**
 * 导出管理器
 * 负责高质量图片导出和数据导出功能
 */

class ExportManager {
    constructor() {
        this.isExporting = false;
        this.exportOptions = {
            // 图片导出选项
            image: {
                scale: 2, // 导出缩放比例 - 降低到2倍，平衡质量和性能
                quality: 0.95, // 图片质量 - 稍微降低以减少文件大小
                format: 'png', // 导出格式
                backgroundColor: '#ffffff', // 背景色
                useCORS: false, // 关闭跨域，避免与allowTaint冲突
                allowTaint: true, // 允许污染画布以支持图片
                removeContainer: false, // 不移除容器
                logging: false // 关闭日志减少性能开销
            },
            // 数据导出选项
            data: {
                includeMetadata: true, // 包含元数据
                prettyFormat: true, // 格式化JSON
                includeStatistics: true // 包含统计信息
            }
        };
    }

    /**
     * 导出为高质量PNG图片
     * @param {HTMLElement} targetElement - 目标元素（默认为画布）
     * @param {Object} options - 导出选项
     * @returns {Promise<string>} 图片数据URL
     */
    async exportToPNG(targetElement = null, options = {}) {
        console.log('🚀 开始导出PNG...');
        
        if (this.isExporting) {
            console.log('❌ 已有导出任务在进行中');
            throw new Error('正在导出中，请稍候...');
        }

        this.isExporting = true;
        console.log('✅ 设置导出状态为true');
        
        // 将element声明在外层作用域，以便在finally块中使用
        let element = null;
        
        try {
            // 显示导出进度
            this.showExportProgress('正在准备导出...');
            console.log('📊 显示导出进度条');
            
            // 获取目标元素
            element = targetElement || document.getElementById('year-circle-canvas');
            console.log('🎯 目标元素:', element);
            
            if (!element) {
                console.log('❌ 未找到目标元素');
                throw new Error('未找到要导出的元素');
            }

            // 验证元素是否可见和有内容
            console.log('📏 元素尺寸:', {
                offsetWidth: element.offsetWidth,
                offsetHeight: element.offsetHeight,
                clientWidth: element.clientWidth,
                clientHeight: element.clientHeight,
                scrollWidth: element.scrollWidth,
                scrollHeight: element.scrollHeight
            });
            
            if (element.offsetWidth === 0 || element.offsetHeight === 0) {
                console.log('❌ 元素尺寸为零');
                throw new Error('导出元素尺寸为零，请检查页面布局');
            }

            // 检查是否有html2canvas库
            console.log('📚 html2canvas可用性:', typeof html2canvas !== 'undefined');
            if (typeof html2canvas === 'undefined') {
                console.log('❌ html2canvas库未加载');
                throw new Error('html2canvas库未加载，请刷新页面重试');
            }

            // 合并导出选项
            const exportOptions = {
                ...this.exportOptions.image,
                ...options
            };

            // 预处理元素（优化导出效果）
            await this.preprocessForExport(element);
            
            this.updateExportProgress('正在计算尺寸...', 20);

            // 获取实际内容尺寸
            console.log('📐 开始计算画布尺寸...');
            const canvasSize = this.getCanvasSize(element);
            console.log('📐 计算得到的尺寸:', { actualWidth: canvasSize.actualWidth, actualHeight: canvasSize.actualHeight });
            console.log('画布尺寸信息:', canvasSize);

            this.updateExportProgress('正在生成图片...', 40);
            console.log('📊 更新进度: 正在生成图片...');

            // 配置html2canvas选项
            const html2canvasOptions = {
                scale: 1, // 修改为1:1比例，避免截断问题
                useCORS: exportOptions.useCORS,
                allowTaint: true, // 允许污染画布以支持图片
                backgroundColor: exportOptions.backgroundColor,
                removeContainer: false, // 保留容器以确保正确定位
                logging: exportOptions.logging,
                width: canvasSize.actualWidth,
                height: canvasSize.actualHeight,
                imageTimeout: 15000, // 增加图片加载超时时间
                foreignObjectRendering: true, // 启用外部对象渲染
                scrollX: 0, // 确保从左上角开始
                scrollY: 0,
                windowWidth: canvasSize.actualWidth, // 设置窗口宽度
                windowHeight: canvasSize.actualHeight, // 设置窗口高度
                x: 0, // 明确设置起始X坐标
                y: 0, // 明确设置起始Y坐标
                ignoreElements: (element) => {
                    // 忽略工具栏和其他UI元素
                    return element.classList.contains('toolbar') || 
                           element.classList.contains('loading-overlay') ||
                           element.classList.contains('export-progress') ||
                           element.id === 'context-menu';
                },
                onclone: (clonedDoc) => {
                    // 在克隆文档中进行额外处理
                    this.optimizeClonedDocument(clonedDoc);
                }
            };
            console.log('⚙️ html2canvas配置:', html2canvasOptions);
            
            // 记录目标元素的详细信息
            const targetRect = element.getBoundingClientRect();
            console.log('🎯 目标元素详细信息:', {
                id: element.id,
                className: element.className,
                rect: { left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height },
                offset: { width: element.offsetWidth, height: element.offsetHeight, left: element.offsetLeft, top: element.offsetTop },
                scroll: { width: element.scrollWidth, height: element.scrollHeight, left: element.scrollLeft, top: element.scrollTop },
                client: { width: element.clientWidth, height: element.clientHeight },
                style: {
                    position: window.getComputedStyle(element).position,
                    transform: window.getComputedStyle(element).transform,
                    transformOrigin: window.getComputedStyle(element).transformOrigin
                }
            });
            
            // 计算容器的实际偏移量（相对于视口的位置）
            const containerOffsetX = targetRect.left;
            const containerOffsetY = targetRect.top;
            
            console.log('📍 容器偏移量:', {
                offsetX: containerOffsetX,
                offsetY: containerOffsetY
            });
            
            // 更新html2canvas配置以正确处理偏移
            // 使用负偏移来补偿容器的位置偏移
            html2canvasOptions.scrollX = -containerOffsetX;
            html2canvasOptions.scrollY = -containerOffsetY;
            html2canvasOptions.x = 0;
            html2canvasOptions.y = 0;
            html2canvasOptions.width = canvasSize.actualWidth;
            html2canvasOptions.height = canvasSize.actualHeight + containerOffsetY;
            html2canvasOptions.windowWidth = window.innerWidth;
            html2canvasOptions.windowHeight = window.innerHeight;

            console.log('⚙️ 更新后的html2canvas配置:', html2canvasOptions);
            
            console.log('🎨 开始html2canvas渲染...');
            const canvas = await html2canvas(element, html2canvasOptions);
            console.log('🎨 html2canvas渲染完成, canvas:', canvas);
            console.log('🎨 生成的canvas尺寸:', { width: canvas.width, height: canvas.height });

            this.updateExportProgress('正在处理图片...', 70);

            // 转换为数据URL
            const dataURL = canvas.toDataURL(`image/${exportOptions.format}`, exportOptions.quality);
            
            this.updateExportProgress('导出完成', 100);
            
            // 恢复元素状态
            await this.postprocessAfterExport(element);
            
            return dataURL;

        } catch (error) {
            console.error('导出PNG时发生错误:', error);
            
            // 根据错误类型提供更具体的错误信息
            let errorMessage = '导出失败';
            if (error.message) {
                if (error.message.includes('html2canvas')) {
                    errorMessage = '图片渲染失败，请检查页面内容';
                } else if (error.message.includes('memory') || error.message.includes('Memory')) {
                    errorMessage = '内存不足，请尝试降低导出质量';
                } else if (error.message.includes('timeout')) {
                    errorMessage = '导出超时，请重试';
                } else {
                    errorMessage = `导出失败: ${error.message}`;
                }
            }
            
            // 创建包含更多信息的错误对象
            const enhancedError = new Error(errorMessage);
            enhancedError.originalError = error;
            enhancedError.timestamp = new Date().toISOString();
            
            throw enhancedError;
        } finally {
            // 确保无论成功还是失败都隐藏进度条并重置状态
            try {
                if (element) {
                    await this.postprocessAfterExport(element);
                }
            } catch (cleanupError) {
                console.warn('清理过程中发生错误:', cleanupError);
            }
            
            this.hideExportProgress();
            this.isExporting = false;
            console.log('🔄 导出状态已重置');
        }
    }

    /**
     * 下载PNG图片
     * @param {string} filename - 文件名
     * @param {HTMLElement} targetElement - 目标元素
     * @param {Object} options - 导出选项
     */
    async downloadPNG(filename = null, targetElement = null, options = {}) {
        try {
            const dataURL = await this.exportToPNG(targetElement, options);
            
            // 生成文件名
            const finalFilename = filename || this.generateFilename('png');
            
            // 创建下载链接
            const link = document.createElement('a');
            link.download = finalFilename;
            link.href = dataURL;
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 成功后显示提示
            console.log('PNG导出成功:', finalFilename);
            
        } catch (error) {
            console.error('导出失败:', error);
            alert(`导出失败: ${error.message || '未知错误'}，请重试`);
            // 如果exportToPNG失败，确保重置状态
            this.hideExportProgress();
            this.isExporting = false;
        }
    }

    /**
     * 导出数据为JSON
     * @param {Object} options - 导出选项
     * @returns {Object} 导出的数据
     */
    exportToJSON(options = {}) {
        const exportOptions = {
            ...this.exportOptions.data,
            ...options
        };

        const exportData = {
            // 基本信息
            version: '1.0',
            exportTime: new Date().toISOString(),
            
            // 应用数据
            currentYear: window.circleRenderer?.currentYear || new Date().getFullYear(),
            
            // 记录数据
            records: window.recordManager?.exportRecords() || [],
        };

        // 包含元数据
        if (exportOptions.includeMetadata) {
            exportData.metadata = {
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                canvasSize: this.getCanvasSize(),
                recordCount: exportData.records.length
            };
        }

        // 包含统计信息
        if (exportOptions.includeStatistics && window.recordManager) {
            exportData.statistics = window.recordManager.getStatistics();
        }

        return exportData;
    }

    /**
     * 下载JSON数据
     * @param {string} filename - 文件名
     * @param {Object} options - 导出选项
     */
    downloadJSON(filename = null, options = {}) {
        try {
            const data = this.exportToJSON(options);
            const exportOptions = {
                ...this.exportOptions.data,
                ...options
            };
            
            // 转换为JSON字符串
            const jsonString = exportOptions.prettyFormat 
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data);
            
            // 创建Blob
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // 生成文件名
            const finalFilename = filename || this.generateFilename('json');
            
            // 创建下载链接
            const link = document.createElement('a');
            link.download = finalFilename;
            link.href = URL.createObjectURL(blob);
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理URL对象
            URL.revokeObjectURL(link.href);
            
        } catch (error) {
            alert('数据导出失败，请重试');
        }
    }

    /**
     * 导出前预处理
     * @param {HTMLElement} element - 目标元素
     */
    async preprocessForExport(element) {
        // 确保所有图片都已加载
        await this.ensureImagesLoaded(element);
        
        // 临时隐藏不需要导出的元素
        this.hideUIElements();
        
        // 优化样式以提高导出质量
        this.optimizeStylesForExport(element);
        
        // 临时移除overflow限制，确保能捕获完整内容
        this.originalOverflow = element.style.overflow;
        element.style.overflow = 'visible';
        
        console.log('🔧 预处理完成：移除overflow限制，原值:', this.originalOverflow);
    }

    /**
     * 导出后后处理
     * @param {HTMLElement} element - 目标元素
     */
    async postprocessAfterExport(element) {
        // 恢复overflow设置
        if (this.originalOverflow !== undefined) {
            element.style.overflow = this.originalOverflow;
            console.log('🔧 后处理完成：恢复overflow设置为:', this.originalOverflow);
            this.originalOverflow = undefined;
        }
        
        // 恢复UI元素显示
        this.showUIElements();
        
        // 恢复原始样式
        this.restoreOriginalStyles(element);
    }

    /**
     * 确保所有图片都已加载并完全渲染
     * @param {HTMLElement} element - 目标元素
     */
    async ensureImagesLoaded(element) {
        const images = element.querySelectorAll('img');
        console.log(`开始加载 ${images.length} 张图片...`);
        
        // 第一步：等待所有图片加载完成
        const loadPromises = Array.from(images).map((img, index) => {
            return new Promise((resolve) => {
                if (img.complete && img.naturalWidth > 0) {
                    resolve();
                } else {
                    img.onload = () => {
                        resolve();
                    };
                    img.onerror = () => {
                        resolve(); // 即使加载失败也继续
                    };
                    
                    // 如果图片有src但还没开始加载，强制重新加载
                    if (img.src && !img.complete) {
                        const originalSrc = img.src;
                        img.src = '';
                        img.src = originalSrc;
                    }
                }
            });
        });
        
        await Promise.all(loadPromises);
        console.log('所有图片加载完成，等待渲染...');
        
        // 第二步：额外等待时间确保图片完全渲染
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 第三步：再次检查图片状态
        const finalCheck = Array.from(images).map((img, index) => {
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                console.warn(`图片 ${index + 1} 可能未正确加载 (naturalWidth: ${img.naturalWidth}, naturalHeight: ${img.naturalHeight})`);
            } else {
                console.log(`图片 ${index + 1} 最终检查通过 (${img.naturalWidth}x${img.naturalHeight})`);
            }
        });
        
        console.log('图片加载和渲染完成');
    }

    /**
     * 隐藏UI元素 - V1.2更新：添加右键菜单隐藏
     */
    hideUIElements() {
        const elementsToHide = [
            '.record-actions',
            '.resize-handle',
            '.tooltip',
            '.modal',
            '.loading-overlay',
            '.context-menu' // V1.2新增：隐藏右键菜单
        ];
        
        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.display = 'none';
                el.dataset.hiddenForExport = 'true';
            });
        });
    }

    /**
     * 显示UI元素
     */
    showUIElements() {
        const hiddenElements = document.querySelectorAll('[data-hidden-for-export="true"]');
        hiddenElements.forEach(el => {
            el.style.display = '';
            delete el.dataset.hiddenForExport;
        });
    }

    /**
     * 优化导出样式
     * @param {HTMLElement} element - 目标元素
     */
    optimizeStylesForExport(element) {
        // 临时提高文字清晰度
        element.style.textRendering = 'optimizeLegibility';
        element.style.fontSmooth = 'always';
        element.style.webkitFontSmoothing = 'antialiased';
        
        // 确保背景色
        if (!element.style.backgroundColor) {
            element.style.backgroundColor = this.exportOptions.image.backgroundColor;
        }
        
        // 标记为导出优化
        element.dataset.exportOptimized = 'true';
    }

    /**
     * 恢复原始样式
     * @param {HTMLElement} element - 目标元素
     */
    restoreOriginalStyles(element) {
        if (element.dataset.exportOptimized) {
            element.style.textRendering = '';
            element.style.fontSmooth = '';
            element.style.webkitFontSmoothing = '';
            delete element.dataset.exportOptimized;
        }
    }

    /**
     * 优化克隆文档
     * @param {Document} clonedDoc - 克隆的文档
     */
    optimizeClonedDocument(clonedDoc) {
        // 移除不必要的元素
        const elementsToRemove = [
            '.tooltip',
            '.modal',
            '.loading-overlay'
        ];
        
        elementsToRemove.forEach(selector => {
            const elements = clonedDoc.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        
        // 确保字体加载
        const fontLinks = document.querySelectorAll('link[rel="stylesheet"]');
        fontLinks.forEach(link => {
            if (!clonedDoc.querySelector(`link[href="${link.href}"]`)) {
                const clonedLink = clonedDoc.createElement('link');
                clonedLink.rel = 'stylesheet';
                clonedLink.href = link.href;
                clonedDoc.head.appendChild(clonedLink);
            }
        });
        
        // 处理图片元素，确保正确显示
        const images = clonedDoc.querySelectorAll('img');
        images.forEach(img => {
            // 确保图片有正确的src属性
            if (img.src) {
                // 如果是base64图片，确保格式正确
                if (img.src.startsWith('data:image/')) {
                    img.setAttribute('crossorigin', 'anonymous');
                }
                // 设置图片样式，确保正确显示
                img.style.display = 'block';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            }
        });
        
        // 确保记录卡片的z-index正确
        const recordCards = clonedDoc.querySelectorAll('.record-card');
        recordCards.forEach(card => {
            card.style.zIndex = '10';
            card.style.position = 'absolute';
        });
    }

    /**
     * 生成文件名
     * @param {string} extension - 文件扩展名
     * @returns {string} 文件名
     */
    generateFilename(extension) {
        const now = new Date();
        const year = window.circleRenderer?.currentYear || now.getFullYear();
        const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
        
        return `年度记录_${year}_${timestamp}.${extension}`;
    }

    /**
     * 获取画布尺寸
     * @param {HTMLElement} element - 目标元素（可选）
     * @returns {Object} 画布尺寸 {width, height, actualWidth, actualHeight}
     */
    getCanvasSize(element = null) {
        const canvas = element || document.getElementById('year-circle-canvas');
        if (!canvas) {
            return { width: 0, height: 0, actualWidth: 0, actualHeight: 0 };
        }

        // 获取容器的基础尺寸
        const containerWidth = canvas.offsetWidth;
        const containerHeight = canvas.offsetHeight;

        console.log('容器尺寸:', {
            width: containerWidth,
            height: containerHeight
        });

        // 计算实际内容边界（包含所有子元素）
        const actualBounds = this.getActualContentBounds(canvas);

        console.log('实际内容边界:', actualBounds);

        return {
            width: containerWidth,
            height: containerHeight,
            actualWidth: Math.max(containerWidth, actualBounds.width),
            actualHeight: Math.max(containerHeight, actualBounds.height),
            bounds: actualBounds
        };
    }

    /**
     * 获取实际内容边界
     * @param {HTMLElement} container - 容器元素
     * @returns {Object} 内容边界 {width, height, left, top, right, bottom}
     */
    getActualContentBounds(container) {
        const containerRect = container.getBoundingClientRect();
        let minX = 0, minY = 0, maxX = container.offsetWidth, maxY = container.offsetHeight;

        // 遍历所有子元素，包括绝对定位的元素
        const allElements = container.querySelectorAll('*');
        
        console.log('🔍 开始计算内容边界，容器尺寸:', {
            width: container.offsetWidth,
            height: container.offsetHeight
        });

        let elementCount = 0;
        let recordCardCount = 0;
        
        // 检查关键元素边界
        const svgElement = container.querySelector('svg');
        const recordsContainer = container.querySelector('.records-container');

        allElements.forEach(element => {
            // 跳过隐藏元素和UI元素
            if (element.offsetWidth === 0 || element.offsetHeight === 0 ||
                element.classList.contains('toolbar') ||
                element.classList.contains('loading-overlay') ||
                element.classList.contains('export-progress')) {
                return;
            }

            elementCount++;
            const rect = element.getBoundingClientRect();
            
            // 转换为相对于容器的坐标
            const relativeLeft = rect.left - containerRect.left;
            const relativeTop = rect.top - containerRect.top;
            const relativeRight = relativeLeft + rect.width;
            const relativeBottom = relativeTop + rect.height;

            // 记录关键元素的位置信息
            if (element.classList.contains('circle-svg') || 
                element.classList.contains('records-container') ||
                element.tagName === 'SVG') {
                console.log(`🔍 关键元素 ${element.tagName}.${element.className}:`, {
                    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                    relative: { left: relativeLeft, top: relativeTop, right: relativeRight, bottom: relativeBottom },
                    style: {
                        position: element.style.position || window.getComputedStyle(element).position,
                        transform: element.style.transform || window.getComputedStyle(element).transform,
                        left: element.style.left || window.getComputedStyle(element).left,
                        top: element.style.top || window.getComputedStyle(element).top
                    }
                });
            }

            // 记录卡片计数
            if (element.classList.contains('record-card')) {
                recordCardCount++;
            }

            // 扩展边界以包含所有内容
            minX = Math.min(minX, relativeLeft);
            minY = Math.min(minY, relativeTop);
            maxX = Math.max(maxX, relativeRight);
            maxY = Math.max(maxY, relativeBottom);
        });
        
        // 确保最小边界为0，但允许内容超出容器
        const finalBounds = {
            left: Math.min(0, minX),
            top: Math.min(0, minY),
            right: maxX,
            bottom: maxY,
            width: maxX - Math.min(0, minX),
            height: maxY - Math.min(0, minY)
        };

        console.log('📊 内容边界:', finalBounds, `(${recordCardCount}个记录卡片)`);
        return finalBounds;
    }

    /**
     * 显示导出进度
     * @param {string} message - 进度消息
     * @param {number} progress - 进度百分比
     */
    showExportProgress(message, progress = 0) {
        let progressOverlay = document.getElementById('export-progress');
        
        if (!progressOverlay) {
            progressOverlay = document.createElement('div');
            progressOverlay.id = 'export-progress';
            progressOverlay.className = 'export-progress-overlay';
            progressOverlay.innerHTML = `
                <div class="export-progress-content">
                    <div class="export-progress-message">正在导出...</div>
                    <div class="export-progress-bar">
                        <div class="export-progress-fill"></div>
                    </div>
                    <div class="export-progress-percent">0%</div>
                </div>
            `;
            document.body.appendChild(progressOverlay);
        }
        
        const messageEl = progressOverlay.querySelector('.export-progress-message');
        const fillEl = progressOverlay.querySelector('.export-progress-fill');
        const percentEl = progressOverlay.querySelector('.export-progress-percent');
        
        messageEl.textContent = message;
        fillEl.style.width = `${progress}%`;
        percentEl.textContent = `${Math.round(progress)}%`;
        
        progressOverlay.style.display = 'flex';
    }

    /**
     * 更新导出进度
     * @param {string} message - 进度消息
     * @param {number} progress - 进度百分比
     */
    updateExportProgress(message, progress) {
        this.showExportProgress(message, progress);
    }

    /**
     * 隐藏导出进度
     */
    hideExportProgress() {
        // 隐藏导出进度条
        const progressOverlay = document.getElementById('export-progress');
        if (progressOverlay) {
            progressOverlay.style.display = 'none';
        }
        
        // 同时隐藏主应用的加载提示（如果存在）
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        console.log('🔄 所有加载提示已隐藏');
    }

    /**
     * 批量导出
     * @param {Array} years - 年份数组
     * @param {string} format - 导出格式 ('png' | 'json' | 'both')
     */
    async batchExport(years, format = 'both') {
        if (this.isExporting) {
            throw new Error('正在导出中，请稍候...');
        }

        this.isExporting = true;
        
        try {
            this.showExportProgress('准备批量导出...', 0);
            
            for (let i = 0; i < years.length; i++) {
                const year = years[i];
                const progress = (i / years.length) * 100;
                
                this.updateExportProgress(`正在导出 ${year} 年...`, progress);
                
                // 切换到指定年份
                if (window.circleRenderer) {
                    window.circleRenderer.renderCircle(year);
                }
                
                // 等待渲染完成
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 导出文件
                if (format === 'png' || format === 'both') {
                    await this.downloadPNG(`年度记录_${year}.png`);
                }
                
                if (format === 'json' || format === 'both') {
                    this.downloadJSON(`年度记录_${year}.json`);
                }
                
                // 短暂延迟，避免浏览器阻塞
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            this.updateExportProgress('批量导出完成', 100);
            
            setTimeout(() => {
                this.hideExportProgress();
            }, 2000);
            
        } catch (error) {
            this.hideExportProgress();
            throw error;
        } finally {
            this.isExporting = false;
        }
    }

    /**
     * 检查导出支持
     * @returns {Object} 支持情况
     */
    checkExportSupport() {
        return {
            html2canvas: typeof html2canvas !== 'undefined',
            download: 'download' in document.createElement('a'),
            blob: typeof Blob !== 'undefined',
            canvas: !!document.createElement('canvas').getContext,
            localStorage: typeof Storage !== 'undefined'
        };
    }

    /**
     * 获取导出统计
     * @returns {Object} 导出统计信息
     */
    getExportStatistics() {
        const support = this.checkExportSupport();
        const canvasSize = this.getCanvasSize();
        
        return {
            support: support,
            canvasSize: canvasSize,
            estimatedFileSize: this.estimateFileSize(canvasSize),
            recommendedScale: this.getRecommendedScale(canvasSize)
        };
    }

    /**
     * 估算文件大小
     * @param {Object} canvasSize - 画布尺寸
     * @returns {string} 估算的文件大小
     */
    estimateFileSize(canvasSize) {
        const pixels = canvasSize.width * canvasSize.height * this.exportOptions.image.scale * this.exportOptions.image.scale;
        const bytes = pixels * 4; // RGBA
        const mb = bytes / (1024 * 1024);
        
        return `约 ${mb.toFixed(1)} MB`;
    }

    /**
     * 获取推荐缩放比例
     * @param {Object} canvasSize - 画布尺寸
     * @returns {number} 推荐的缩放比例
     */
    getRecommendedScale(canvasSize) {
        const totalPixels = canvasSize.width * canvasSize.height;
        
        if (totalPixels > 2000000) { // 大于200万像素
            return 1;
        } else if (totalPixels > 1000000) { // 大于100万像素
            return 2;
        } else {
            return 3;
        }
    }
}

// 导出到全局
window.ExportManager = ExportManager;