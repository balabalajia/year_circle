/**
 * 主应用文件
 * 负责应用初始化和各模块协调
 */

class YearCircleApp {
    constructor() {
        this.isInitialized = false;
        this.currentYear = new Date().getFullYear(); // 默认当前年份，稍后会从存储中恢复
        
        // 核心模块
        this.storageManager = null;
        this.circleRenderer = null;
        this.recordManager = null;
        this.interactionHandler = null;
        this.exportManager = null;
        
        // 应用状态
        this.appState = {
            isLoading: true,
            hasUnsavedChanges: false,
            lastSaveTime: null,
            autoSaveEnabled: true
        };
    }

    /**
     * 初始化应用
     */
    async init() {
        try {
            this.showLoading('正在初始化应用...');
            
            // 检查浏览器兼容性
            this.checkBrowserCompatibility();
            
            // 初始化存储管理器
            await this.initStorageManager();
            
            // 初始化UI组件
            this.initUI();
            
            // 初始化存储UI
            this.initStorageUI();
            this.updateStorageUI();
            
            // 初始化圆环渲染器
            this.initCircleRenderer();
            
            // 初始化记录管理器
            this.initRecordManager();
            
            // 初始化交互处理器
            this.initInteractionHandler();
            
            // 初始化导出管理器
            this.initExportManager();
            
            // V1.5新增：初始化连接线调整管理器
            this.initConnectionLineAdjuster();
            
            // 加载数据
            await this.loadData();
            
            // 渲染初始界面
            this.renderInitialView();
            
            // 设置事件监听
            this.setupEventListeners();
            
            // 启动自动保存
            this.startAutoSave();
            
            this.isInitialized = true;
            this.appState.isLoading = false;
            
            this.hideLoading();
            
        } catch (error) {
            this.showError('应用初始化失败，请刷新页面重试');
        }
    }

    /**
     * 检查浏览器兼容性
     */
    checkBrowserCompatibility() {
        const requiredFeatures = {
            'localStorage': typeof Storage !== 'undefined',
            'canvas': !!document.createElement('canvas').getContext,
            'svg': !!document.createElementNS,
            'es6': typeof Map !== 'undefined' && typeof Set !== 'undefined',
            'fetch': typeof fetch !== 'undefined'
        };
        
        const unsupportedFeatures = Object.entries(requiredFeatures)
            .filter(([feature, supported]) => !supported)
            .map(([feature]) => feature);
        
        if (unsupportedFeatures.length > 0) {
            throw new Error(`浏览器不支持以下功能: ${unsupportedFeatures.join(', ')}`);
        }
    }

    /**
     * 初始化存储管理器
     */
    async initStorageManager() {
        // V1.4升级：初始化文件存储管理器
        if (window.FileStorageManager) {
            window.fileStorageManager = new FileStorageManager();
            
            // 等待目录恢复完成，最多等待3秒
            try {
                await Promise.race([
                    new Promise(async (resolve) => {
                        // 等待数据库初始化完成
                        while (!window.fileStorageManager.dbInitialized) {
                            await new Promise(r => setTimeout(r, 100));
                        }
                        // 然后尝试恢复目录
                        await window.fileStorageManager.restoreDirectoryHandle();
                        resolve();
                    }),
                    new Promise(resolve => setTimeout(resolve, 3000))
                ]);
            } catch (error) {
                console.warn('[App] 目录恢复失败:', error);
            }
        }

        this.storageManager = new StorageManager();
        window.storageManager = this.storageManager;
        
        // V1.4新增：初始化页面关闭前确认
        this.storageManager.initBeforeUnloadHandler();
        
        // 从localStorage恢复上次选择的年份
        this.currentYear = this.storageManager.getCurrentYear();
        
        // 设置自动保存回调
        this.storageManager.enableAutoSave(async () => {
            await this.saveData();
        });

        // V1.4新增：检查是否需要数据迁移（暂时禁用以避免初始化卡住）
        // if (this.storageManager.needsMigration()) {
        //     await this.showMigrationPrompt();
        // }

        // V1.4新增：初始化存储UI
        this.initStorageUI();
    }

    /**
     * 初始化UI组件
     */
    initUI() {
        // 设置年份选择器
        this.setupYearSelector();
        
        // 设置工具栏
        this.setupToolbar();
        
        // 设置起始日期选择器
        this.setupStartDateSelector();
        
        // 设置快捷键提示
        this.setupKeyboardShortcuts();
        
        // V1.4新增：初始化存储UI（已在init方法中调用）
        // this.initStorageUI();
        // this.updateStorageUI();
    }

    /**
     * 初始化圆环渲染器
     */
    initCircleRenderer() {
        const svgElement = document.querySelector('#year-circle-canvas svg');
        if (!svgElement) {
            throw new Error('未找到SVG元素');
        }
        
        this.circleRenderer = new CircleRenderer(svgElement);
        window.circleRenderer = this.circleRenderer;
    }

    /**
     * 初始化记录管理器
     */
    initRecordManager() {
        const recordContainer = document.getElementById('records-container');
        if (!recordContainer) {
            throw new Error('未找到记录容器元素');
        }
        
        this.recordManager = new RecordManager(recordContainer);
        window.recordManager = this.recordManager;
    }

    /**
     * 初始化交互处理器
     */
    initInteractionHandler() {
        this.interactionHandler = new InteractionHandler(
            this.recordManager, 
            this.circleRenderer
        );
        window.interactionHandler = this.interactionHandler;
    }

    /**
     * 初始化导出管理器
     */
    initExportManager() {
        this.exportManager = new ExportManager();
        window.exportManager = this.exportManager;
    }

    /**
     * V1.5新增：初始化连接线调整管理器
     */
    initConnectionLineAdjuster() {
        const svgElement = document.querySelector('#year-circle-canvas svg');
        if (!svgElement) {
            throw new Error('未找到SVG元素');
        }
        
        this.connectionLineAdjuster = new ConnectionLineAdjuster(svgElement);
        window.connectionLineAdjuster = this.connectionLineAdjuster;
    }

    /**
     * V1.4升级：加载数据（支持文件存储）
     */
    async loadData() {
        try {
            const data = await this.storageManager.loadYearData(this.currentYear);
            
            if (data && data.records) {
                this.recordManager.loadRecords(data.records);
                console.log(`[App] 已加载${this.currentYear}年的数据，包含${data.records.length}条记录`);
            } else {
                console.log(`[App] ${this.currentYear}年暂无数据`);
            }
            
            this.appState.lastSaveTime = new Date();
            
        } catch (error) {
            console.error('[App] 加载数据失败:', error);
            // 不抛出错误，允许应用继续运行
        }
    }

    /**
     * 渲染初始界面
     */
    renderInitialView() {
        // 渲染圆环
        this.circleRenderer.renderCircle(this.currentYear);
        
        // 使用requestAnimationFrame确保DOM更新完成后再执行后续操作
        requestAnimationFrame(() => {
            // 加载起始日期（确保在圆环渲染完成后）
            this.loadStartDate();
            
            // 重新应用已记录日期的状态（圆环渲染会重新创建日期小点，需要重新标记）
            this.restoreRecordedDateStates();
            
            // 延迟重新绘制所有连接线，确保圆环已完全渲染
            setTimeout(() => {
                this.redrawAllConnectionLines();
            }, 100);
            
            // 更新年份显示
            this.updateYearDisplay();
            
            // 更新统计信息
            this.updateStatistics();
        });
    }

    /**
     * 设置年份选择器
     * 初始化年份输入框、导航按钮和年份类型指示器
     */
    setupYearSelector() {
        // 获取年份相关元素
        this.yearInput = document.getElementById('year-input');
        this.yearPrevBtn = document.getElementById('year-prev');
        this.yearNextBtn = document.getElementById('year-next');
        this.yearTypeIndicator = document.getElementById('year-type');
        
        if (!this.yearInput) return;
        
        // 设置年份输入框为恢复的年份
        this.yearInput.value = this.currentYear;
        this.updateYearDisplay();
        
        // 年份输入框事件监听
        this.yearInput.addEventListener('input', (e) => {
            const year = parseInt(e.target.value);
            if (year && year >= 1900 && year <= 2100) {
                this.changeYear(year);
            }
        });
        
        // 年份输入框失焦时验证
        this.yearInput.addEventListener('blur', (e) => {
            const year = parseInt(e.target.value);
            if (!year || year < 1900 || year > 2100) {
                e.target.value = this.currentYear;
                this.showMessage('年份必须在1900-2100之间', 'warning');
            }
        });
        
        // 上一年按钮
        if (this.yearPrevBtn) {
            this.yearPrevBtn.addEventListener('click', () => {
                if (this.currentYear > 1900) {
                    this.changeYear(this.currentYear - 1);
                } else {
                    this.showMessage('已到达最早年份', 'warning');
                }
            });
        }
        
        // 下一年按钮
        if (this.yearNextBtn) {
            this.yearNextBtn.addEventListener('click', () => {
                if (this.currentYear < 2100) {
                    this.changeYear(this.currentYear + 1);
                } else {
                    this.showMessage('已到达最晚年份', 'warning');
                }
            });
        }
    }

    /**
     * 设置起始日期选择器
     * 初始化起始日期输入框和重置按钮的事件监听
     */
    setupStartDateSelector() {
        // 获取起始日期相关元素
        this.startDateInput = document.getElementById('start-date-input');
        this.resetStartDateBtn = document.getElementById('reset-start-date');
        
        if (!this.startDateInput) return;
        
        // 从存储中加载起始日期
        this.loadStartDate();
        
        // 起始日期输入框事件监听
        this.startDateInput.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            if (selectedDate) {
                this.handleStartDateChange(selectedDate);
            }
        });
        
        // 重置按钮事件监听
        if (this.resetStartDateBtn) {
            this.resetStartDateBtn.addEventListener('click', () => {
                this.resetStartDate();
            });
        }
    }

    /**
     * 加载起始日期
     * 从localStorage中读取保存的起始日期并设置到输入框
     */
    loadStartDate() {
        try {
            const startDate = this.storageManager.getStartDate(this.currentYear);
            if (startDate) {
                // 确保输入框存在再设置值
                if (this.startDateInput) {
                    this.startDateInput.value = startDate;
                }
                this.currentStartDate = startDate;
                
                // 设置CircleRenderer的起始日期（如果已初始化）
                if (this.circleRenderer) {
                    this.circleRenderer.setStartDate(startDate);
                    // 重新渲染圆形图以显示起始日期标记
                    this.circleRenderer.render();
                }
                
                this.updateYearDisplay();
            } else {
                // 如果没有保存的起始日期，确保输入框为空
                if (this.startDateInput) {
                    this.startDateInput.value = '';
                }
                this.currentStartDate = null;
                
                // 清除CircleRenderer的起始日期（如果已初始化）
                if (this.circleRenderer) {
                    this.circleRenderer.setStartDate(null);
                }
            }
        } catch (error) {
            console.warn('加载起始日期时出错:', error);
            // 出错时重置为默认状态
            if (this.startDateInput) {
                this.startDateInput.value = '';
            }
            this.currentStartDate = null;
        }
    }

    /**
     * 处理起始日期变化
     * @param {string} dateString - 选择的日期字符串 (YYYY-MM-DD格式)
     */
    handleStartDateChange(dateString) {
        try {
            
            // 保存起始日期到localStorage
            const saveSuccess = this.storageManager.saveStartDate(this.currentYear, dateString);
            if (!saveSuccess) {
                throw new Error('保存起始日期失败');
            }
            
            this.currentStartDate = dateString;
            
            // 设置CircleRenderer的起始日期
            if (this.circleRenderer) {
                this.circleRenderer.setStartDate(dateString);
                // 重新渲染圆形图以显示起始日期标记
                this.circleRenderer.render();
            }
            
            // 更新年份显示
            this.updateYearDisplay();
            
            this.showMessage('起始日期已设置', 'success');
        } catch (error) {
            console.error('[App] 处理起始日期变化失败:', error);
            this.showMessage('保存起始日期失败', 'error');
        }
    }

    /**
     * 重置起始日期
     * 清除保存的起始日期并恢复默认状态
     */
    resetStartDate() {
        try {
            
            // 从localStorage中删除起始日期
            const resetSuccess = this.storageManager.resetStartDate(this.currentYear);
            if (!resetSuccess) {
                throw new Error('重置起始日期失败');
            }
            
            this.currentStartDate = null;
            
            // 清空输入框
            if (this.startDateInput) {
                this.startDateInput.value = '';
            }
            
            // 清除CircleRenderer的起始日期
            if (this.circleRenderer) {
                this.circleRenderer.setStartDate(null);
                // 重新渲染圆形图
                this.circleRenderer.render();
            }
            
            // 更新年份显示
            this.updateYearDisplay();
            
            this.showMessage('起始日期已重置', 'success');
        } catch (error) {
            console.error('[App] 重置起始日期失败:', error);
            this.showMessage('重置起始日期失败', 'error');
        }
    }

    /**
     * 设置工具栏
     */
    setupToolbar() {
        // 导出按钮
        const exportPngBtn = document.getElementById('export-png');
        const exportJsonBtn = document.getElementById('export-json');
        const importJsonBtn = document.getElementById('import-json');
        const clearAllBtn = document.getElementById('clear-all');
        
        if (exportPngBtn) {
            exportPngBtn.addEventListener('click', () => {
                this.exportManager.downloadPNG();
            });
        }
        
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                this.exportManager.downloadJSON();
            });
        }
        
        if (importJsonBtn) {
            importJsonBtn.addEventListener('click', () => {
                this.showImportDialog();
            });
        }
        
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllRecords();
            });
        }
    }

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveData();
            }
            
            // Ctrl/Cmd + E: 导出PNG
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportManager.downloadPNG();
            }
            
            // Ctrl/Cmd + Shift + E: 导出JSON
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                this.exportManager.downloadJSON();
            }
            
            // Ctrl/Cmd + 左箭头: 上一年
            if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
                e.preventDefault();
                if (this.yearPrevBtn && !this.yearPrevBtn.disabled) {
                    this.yearPrevBtn.click();
                }
            }
            
            // Ctrl/Cmd + 右箭头: 下一年
            if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
                e.preventDefault();
                if (this.yearNextBtn && !this.yearNextBtn.disabled) {
                    this.yearNextBtn.click();
                }
            }
        });
    }

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 监听窗口关闭前事件
        window.addEventListener('beforeunload', (e) => {
            if (this.appState.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });
        
        // 监听窗口大小变化
        window.addEventListener('resize', debounce(() => {
            this.handleWindowResize();
        }, 250));
        
        // 监听在线状态变化
        window.addEventListener('online', () => {
            this.showMessage('网络连接已恢复', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.showMessage('网络连接已断开，数据将保存在本地', 'warning');
        });
        
        // 监听数据变化
        document.addEventListener('recordCreated', () => {
            this.markAsChanged();
            this.updateStatistics();
        });
        
        document.addEventListener('recordUpdated', () => {
            this.markAsChanged();
            this.updateStatistics();
        });
        
        document.addEventListener('recordDeleted', () => {
            this.markAsChanged();
            this.updateStatistics();
        });
    }

    /**
     * 切换年份
     * @param {number} year - 目标年份
     */
    async changeYear(year) {
        if (year === this.currentYear) return;
        
        try {
            this.showLoading('正在切换年份...');
            
            // 保存当前年份数据
            await this.saveData();
            
            // 切换到新年份
            this.currentYear = year;
            this.recordManager.currentYear = year;
            
            // 保存当前年份到localStorage
            this.storageManager.saveCurrentYear(year);
            
            // 加载新年份数据
            await this.loadData();
            
            // 重新渲染圆形图（在加载起始日期之前）
            this.circleRenderer.renderCircle(year);
            
            // 使用requestAnimationFrame确保DOM更新完成后再执行后续操作
            requestAnimationFrame(() => {
                // 加载起始日期（确保在CircleRenderer渲染完成后）
                this.loadStartDate();
                
                // 恢复记录状态
                this.restoreRecordedDateStates();
                
                // 延迟重新绘制连接线
                setTimeout(() => {
                    this.redrawAllConnectionLines();
                }, 100);
                
                this.updateYearDisplay();
                this.updateStatistics();
            });
            
            this.hideLoading();
            
        } catch (error) {
            this.showError('年份切换失败，请重试');
            this.hideLoading();
        }
    }

    /**
     * V1.4升级：保存数据（支持文件存储）
     */
    async saveData() {
        try {
            const data = {
                year: this.currentYear,
                records: this.recordManager.exportRecords(),
                savedAt: new Date().toISOString()
            };
            
            const success = await this.storageManager.saveYearData(this.currentYear, data);
            
            if (success) {
                this.appState.hasUnsavedChanges = false;
                this.appState.lastSaveTime = new Date();
                // 注意：成功消息已在StorageManager中显示，这里不重复显示
            } else {
                this.showError('数据保存失败，请重试');
            }
            
        } catch (error) {
            console.error('[App] 保存数据失败:', error);
            this.showError('数据保存失败，请重试');
        }
    }

    /**
     * 启动自动保存
     */
    startAutoSave() {
        if (!this.appState.autoSaveEnabled) return;
        
        setInterval(() => {
            if (this.appState.hasUnsavedChanges) {
                this.saveData();
            }
        }, 30000); // 每30秒自动保存
    }

    /**
     * 标记为已更改
     */
    markAsChanged() {
        this.appState.hasUnsavedChanges = true;
    }

    /**
     * 计算年份范围显示
     * 根据起始日期计算年份范围
     * @returns {string} 年份显示字符串
     */
    getYearDisplayText() {
        if (!this.currentStartDate) {
            return this.currentYear.toString();
        }
        
        const startDate = new Date(this.currentStartDate);
        const startMonth = startDate.getMonth() + 1; // 月份从0开始，需要+1
        const startDay = startDate.getDate();
        
        // 如果起始日期是1月1日，则不需要范围显示
        if (startMonth === 1 && startDay === 1) {
            return this.currentYear.toString();
        }
        
        // 计算结束年份
        const endYear = this.currentYear + 1;
        return `${this.currentYear}-${endYear}`;
    }

    /**
     * 获取年份范围详细信息
     * 包括闰年判断和详细说明
     * @returns {Object} 包含显示文本、闰年状态和提示信息的对象
     */
    getYearRangeInfo() {
        if (!this.currentStartDate) {
            const isLeapYear = DateUtils.isLeapYear(this.currentYear);
            return {
                text: isLeapYear ? '闰年' : '平年',
                hasLeapYear: isLeapYear,
                tooltip: `${this.currentYear}年是${isLeapYear ? '闰年' : '平年'}`
            };
        }

        const startDate = new Date(this.currentStartDate);
        const startMonth = startDate.getMonth() + 1;
        const startDay = startDate.getDate();
        
        // 计算2月份所在的年份
        let februaryYear;
        if (startMonth <= 2) {
            // 如果起始日期在2月或之前，2月份在当前年
            februaryYear = this.currentYear;
        } else {
            // 如果起始日期在2月之后，2月份在下一年
            februaryYear = this.currentYear + 1;
        }
        
        const isCurrentYearLeap = DateUtils.isLeapYear(this.currentYear);
        const isNextYearLeap = DateUtils.isLeapYear(this.currentYear + 1);
        const isFebruaryYearLeap = DateUtils.isLeapYear(februaryYear);
        
        // 构建显示文本
        let displayText = '自定义周期';
        if (isFebruaryYearLeap) {
            displayText += ' (含闰年)';
        }
        
        // 构建详细提示信息
        const yearRange = `${this.currentYear}-${this.currentYear + 1}`;
        let tooltip = `自定义周期: ${yearRange}\n`;
        tooltip += `起始日期: ${DateUtils.formatDate(this.currentYear, startMonth, startDay)}\n`;
        tooltip += `${this.currentYear}年: ${isCurrentYearLeap ? '闰年' : '平年'}\n`;
        tooltip += `${this.currentYear + 1}年: ${isNextYearLeap ? '闰年' : '平年'}\n`;
        tooltip += `2月份在${februaryYear}年 (${isFebruaryYearLeap ? '闰年29天' : '平年28天'})`;
        
        return {
            text: displayText,
            hasLeapYear: isFebruaryYearLeap,
            tooltip: tooltip
        };
    }

    /**
     * 更新年份显示
     * 更新年份输入框、类型指示器和相关UI元素
     */
    updateYearDisplay() {
        // 更新输入框值
        if (this.yearInput) {
            this.yearInput.value = this.currentYear;
        }
        
        // 获取年份显示文本
        const yearDisplayText = this.getYearDisplayText();
        
        // 更新年份类型指示器
        if (this.yearTypeIndicator) {
            if (this.currentStartDate) {
                // 如果设置了起始日期，显示详细的年份范围和闰年信息
                const yearRangeInfo = this.getYearRangeInfo();
                this.yearTypeIndicator.textContent = yearRangeInfo.text;
                this.yearTypeIndicator.className = `year-type-indicator custom-cycle ${yearRangeInfo.hasLeapYear ? 'has-leap-year' : ''}`;
                this.yearTypeIndicator.title = yearRangeInfo.tooltip;
            } else {
                // 默认显示闰年/平年
                const isLeapYear = DateUtils.isLeapYear(this.currentYear);
                this.yearTypeIndicator.textContent = isLeapYear ? '闰年' : '平年';
                this.yearTypeIndicator.className = `year-type-indicator ${isLeapYear ? 'leap-year' : ''}`;
                this.yearTypeIndicator.title = `${this.currentYear}年是${isLeapYear ? '闰年' : '平年'}`;
            }
        }
        
        // 更新按钮状态
        if (this.yearPrevBtn) {
            this.yearPrevBtn.disabled = this.currentYear <= 1900;
            this.yearPrevBtn.style.opacity = this.currentYear <= 1900 ? '0.5' : '1';
        }
        
        if (this.yearNextBtn) {
            this.yearNextBtn.disabled = this.currentYear >= 2100;
            this.yearNextBtn.style.opacity = this.currentYear >= 2100 ? '0.5' : '1';
        }
        
        // 更新页面标题
        document.title = `环形月份图画布 - ${yearDisplayText}`;
        
        // 更新其他年份显示元素（如果存在）
        const yearDisplay = document.querySelector('.year-display');
        if (yearDisplay) {
            yearDisplay.textContent = yearDisplayText;
        }
    }

    /**
     * 更新统计信息
     */
    updateStatistics() {
        const stats = this.recordManager.getStatistics();
        
        // 更新统计显示
        const statsElements = {
            total: document.querySelector('.stats-total'),
            text: document.querySelector('.stats-text'),
            image: document.querySelector('.stats-image')
        };
        
        if (statsElements.total) {
            statsElements.total.textContent = stats.total;
        }
        if (statsElements.text) {
            statsElements.text.textContent = stats.textRecords;
        }
        if (statsElements.image) {
            statsElements.image.textContent = stats.imageRecords;
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleWindowResize() {
        if (this.circleRenderer) {
            this.circleRenderer.handleResize();
        }
        
        if (this.interactionHandler) {
            this.interactionHandler.updateCanvasBounds();
        }
        
        // 延迟重新绘制连接线，确保圆环重新渲染完成
        setTimeout(() => {
            this.redrawAllConnectionLines();
        }, 100);
    }

    /**
     * 显示导入对话框
     */
    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importData(file);
            }
        });
        
        input.click();
    }

    /**
     * 导入数据
     * @param {File} file - JSON文件
     */
    async importData(file) {
        try {
            this.showLoading('正在导入数据...');
            
            const text = await file.text();
            const data = JSON.parse(text);
            
            // 验证数据格式
            if (!data.records || !Array.isArray(data.records)) {
                throw new Error('无效的数据格式');
            }
            
            // 确认导入
            const confirmed = confirm(`将导入 ${data.records.length} 条记录，这将覆盖当前数据。确定继续吗？`);
            if (!confirmed) {
                this.hideLoading();
                return;
            }
            
            // 导入数据
            this.recordManager.loadRecords(data.records);
            
            // 如果数据包含年份信息，切换到对应年份
            if (data.currentYear && data.currentYear !== this.currentYear) {
                this.currentYear = data.currentYear;
                this.circleRenderer.renderCircle(this.currentYear);
                this.updateYearDisplay();
            }
            
            // 保存数据
            await this.saveData();
            
            this.updateStatistics();
            this.hideLoading();
            
            this.showMessage(`成功导入 ${data.records.length} 条记录`, 'success');
            
        } catch (error) {
            this.showError('数据导入失败，请检查文件格式');
            this.hideLoading();
        }
    }

    /**
     * 清空所有记录
     */
    clearAllRecords() {
        const confirmed = confirm('确定要清空所有记录吗？此操作不可撤销。');
        if (!confirmed) return;
        
        this.recordManager.clearAllRecords();
        this.saveData();
        this.updateStatistics();
        
        this.showMessage('所有记录已清空', 'info');
    }

    /**
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message = '加载中...') {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            const messageEl = loadingOverlay.querySelector('.loading-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
            loadingOverlay.style.display = 'flex';
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * 显示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 ('success', 'error', 'warning', 'info')
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        // 添加到页面
        document.body.appendChild(messageEl);
        
        // 显示动画
        setTimeout(() => {
            messageEl.classList.add('show');
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        this.showMessage(message, 'error');
    }

    /**
     * V1.4新增：显示数据迁移提示
     */
    async showMigrationPrompt() {
        const shouldMigrate = confirm(
            '检测到您有存储在浏览器中的数据，是否要迁移到本地文件存储？\n\n' +
            '迁移后数据将保存在您选择的文件夹中，更加安全可靠。\n' +
            '点击"确定"开始迁移，点击"取消"继续使用浏览器存储。'
        );

        if (shouldMigrate) {
            await this.performDataMigration();
        }
    }

    /**
     * V1.4新增：执行数据迁移
     */
    async performDataMigration() {
        try {
            this.showLoading('正在迁移数据到本地文件...');
            
            // 首先请求文件夹访问权限
            const hasPermission = await window.fileStorageManager.requestStorageDirectory();
            if (!hasPermission) {
                this.hideLoading();
                this.showMessage('需要文件夹访问权限才能进行数据迁移', 'warning');
                return;
            }

            // 执行迁移
            const migrationStats = await this.storageManager.migrateToFileStorage();
            
            this.hideLoading();
            
            if (migrationStats.success > 0) {
                this.showMessage(
                    `数据迁移完成！成功迁移 ${migrationStats.success} 个年份的数据。`, 
                    'success'
                );
                
                // 启用文件存储偏好
                this.storageManager.preferFileStorage = true;
                this.updateStorageUI();
            } else {
                this.showMessage('数据迁移失败，将继续使用浏览器存储。', 'warning');
            }
        } catch (error) {
            this.hideLoading();
            console.error('[App] 数据迁移失败:', error);
            this.showError('数据迁移过程中出现错误：' + error.message);
        }
    }

    /**
     * V1.4新增：初始化存储UI
     */
    initStorageUI() {
        // 绑定存储设置按钮事件
        const storageSettingsBtn = document.getElementById('storage-settings');
        if (storageSettingsBtn) {
            storageSettingsBtn.addEventListener('click', () => {
                this.showStorageSettings();
            });
        }

        // 初始化存储设置模态框
        this.initStorageSettingsModal();

        // 更新存储状态显示
        this.updateStorageUI();
    }

    /**
     * V1.4新增：初始化存储设置模态框
     */
    initStorageSettingsModal() {
        const modal = document.getElementById('storage-settings-modal');
        if (!modal) return;

        // 关闭按钮事件
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        
        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.hideStorageSettings();
                });
            }
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideStorageSettings();
            }
        });

        // 存储类型选择事件
        const storageTypeRadios = modal.querySelectorAll('input[name="storage-type"]');
        storageTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleStorageTypeChange(radio.value);
            });
        });

        // 选择文件夹按钮
        const selectFolderBtn = document.getElementById('select-folder-btn');
        if (selectFolderBtn) {
            selectFolderBtn.addEventListener('click', async () => {
                await this.selectStorageFolder();
            });
        }

        // 迁移数据按钮
        const migrateDataBtn = document.getElementById('migrate-data-btn');
        if (migrateDataBtn) {
            migrateDataBtn.addEventListener('click', async () => {
                await this.performDataMigration();
                this.hideStorageSettings();
            });
        }

        // 保存设置按钮
        const saveBtn = modal.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveStorageSettings();
            });
        }
    }

    /**
     * V1.4新增：显示存储设置模态框
     */
    showStorageSettings() {
        const modal = document.getElementById('storage-settings-modal');
        if (!modal) return;

        // 更新模态框内容
        this.updateStorageSettingsModal();
        
        // 显示模态框
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }

    /**
     * V1.4新增：隐藏存储设置模态框
     */
    hideStorageSettings() {
        const modal = document.getElementById('storage-settings-modal');
        if (!modal) return;

        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    /**
     * V1.4新增：更新存储设置模态框内容
     */
    updateStorageSettingsModal() {
        // 更新当前存储类型
        const currentStorageType = document.getElementById('current-storage-type');
        if (currentStorageType) {
            currentStorageType.textContent = this.storageManager.preferFileStorage ? '本地文件存储' : '浏览器存储';
        }

        // 更新单选按钮状态
        const browserStorageRadio = document.querySelector('input[name="storage-type"][value="browser"]');
        const fileStorageRadio = document.getElementById('file-storage-option');
        
        if (browserStorageRadio && fileStorageRadio) {
            if (this.storageManager.preferFileStorage) {
                fileStorageRadio.checked = true;
                browserStorageRadio.checked = false;
            } else {
                browserStorageRadio.checked = true;
                fileStorageRadio.checked = false;
            }
        }

        // 更新最后保存时间
        const lastSaveTime = document.getElementById('last-save-time');
        if (lastSaveTime) {
            if (this.appState.lastSaveTime) {
                lastSaveTime.textContent = this.appState.lastSaveTime.toLocaleString();
            } else {
                lastSaveTime.textContent = '未保存';
            }
        }

        // 更新已保存年份数量
        const savedYearsCount = document.getElementById('saved-years-count');
        if (savedYearsCount) {
            const savedYears = this.storageManager.getSavedYears();
            savedYearsCount.textContent = savedYears.length;
        }

        // 更新文件存储状态
        this.updateFileStorageStatus();

        // 更新按钮显示状态
        this.updateStorageActionButtons();
    }

    /**
     * V1.4新增：更新文件存储状态显示
     */
    updateFileStorageStatus() {
        const fileStorageStatus = document.getElementById('file-storage-status');
        const statusText = fileStorageStatus?.querySelector('.status-text');
        
        if (!fileStorageStatus || !statusText) return;

        if (!window.fileStorageManager || !window.fileStorageManager.isSupported()) {
            statusText.textContent = '不支持';
            fileStorageStatus.className = 'option-status error';
        } else if (window.fileStorageManager.getStorageStatus().hasDirectoryAccess) {
            statusText.textContent = '已设置';
            fileStorageStatus.className = 'option-status ready';
        } else {
            statusText.textContent = '未设置';
            fileStorageStatus.className = 'option-status not-ready';
        }
    }

    /**
     * V1.4新增：更新存储操作按钮状态
     */
    updateStorageActionButtons() {
        const selectFolderBtn = document.getElementById('select-folder-btn');
        const migrateDataBtn = document.getElementById('migrate-data-btn');

        if (selectFolderBtn) {
            const fileStorageRadio = document.getElementById('file-storage-option');
            const isFileStorageSelected = fileStorageRadio?.checked;
            const isSupported = window.fileStorageManager?.isSupported();
            
            selectFolderBtn.style.display = (isFileStorageSelected && isSupported) ? 'block' : 'none';
        }

        if (migrateDataBtn) {
            const hasLocalData = this.storageManager.getSavedYears().length > 0;
            const hasFileAccess = window.fileStorageManager?.getStorageStatus().hasDirectoryAccess;
            
            migrateDataBtn.style.display = (hasLocalData && hasFileAccess) ? 'block' : 'none';
        }
    }

    /**
     * V1.4新增：处理存储类型变更
     */
    handleStorageTypeChange(storageType) {
        this.updateStorageActionButtons();
    }

    /**
     * V1.4新增：选择存储文件夹
     */
    async selectStorageFolder() {
        try {
            const hasAccess = await window.fileStorageManager.requestStorageDirectory();
            if (hasAccess) {
                this.showMessage('文件夹访问权限已获取', 'success');
                this.updateFileStorageStatus();
                this.updateStorageActionButtons();
            } else {
                this.showMessage('未获取到文件夹访问权限', 'warning');
            }
        } catch (error) {
            console.error('[App] 选择存储文件夹失败:', error);
            this.showError('选择存储文件夹失败：' + error.message);
        }
    }

    /**
     * V1.4新增：保存存储设置
     */
    saveStorageSettings() {
        const fileStorageRadio = document.getElementById('file-storage-option');
        const useFileStorage = fileStorageRadio?.checked;

        if (useFileStorage && (!window.fileStorageManager?.getStorageStatus().hasDirectoryAccess)) {
            this.showMessage('请先选择存储文件夹', 'warning');
            return;
        }

        // 保存存储偏好设置到 localStorage
        this.storageManager.saveStoragePreference(useFileStorage);
        
        // 更新UI
        this.updateStorageUI();
        
        // 关闭模态框
        this.hideStorageSettings();
        
        this.showMessage('存储设置已保存', 'success');
    }

    /**
     * V1.4新增：更新存储状态UI
     */
    updateStorageUI() {
        const storageStatus = document.querySelector('.storage-status');
        const storageType = document.getElementById('storage-type');
        
        if (!storageStatus || !storageType || !this.storageManager) return;

        console.log('[App] 更新存储UI - preferFileStorage:', this.storageManager.preferFileStorage, 
                   'hasDirectoryAccess:', window.fileStorageManager?.getStorageStatus().hasDirectoryAccess);

        // 检查存储偏好设置
        if (this.storageManager.preferFileStorage) {
            // 用户选择了文件存储
            if (window.fileStorageManager?.getStorageStatus().hasDirectoryAccess) {
                // 有目录访问权限
                storageStatus.className = 'storage-status file-storage';
                storageType.textContent = '本地文件存储';
            } else {
                // 没有目录访问权限，需要选择目录
                storageStatus.className = 'storage-status file-storage-pending';
                storageType.textContent = '文件存储（需要选择目录）';
            }
        } else {
            // 用户选择了浏览器存储
            storageStatus.className = 'storage-status browser-storage';
            storageType.textContent = '浏览器存储';
        }
    }

    /**
     * 重新绘制所有连接线
     * 用于页面加载或窗口大小变化后确保连接线正确显示
     */
    redrawAllConnectionLines() {
        
        if (!this.recordManager || !this.circleRenderer) {
            console.warn('[App] recordManager或circleRenderer不存在，无法重绘连接线');
            return;
        }
        
        // 使用recordManager的新方法来绘制所有连接线
        this.recordManager.drawAllConnectionLines();
    }

    /**
     * 恢复已记录日期的状态
     * 在圆环重新渲染后，重新标记所有有记录的日期
     */
    restoreRecordedDateStates() {
        if (!this.recordManager || !this.circleRenderer) return;
        
        // 获取所有记录
        const records = this.recordManager.getAllRecords();
        
        // 统计每个日期的记录数量
        const dateRecordCounts = new Map();
        records.forEach(record => {
            const count = dateRecordCounts.get(record.date) || 0;
            dateRecordCounts.set(record.date, count + 1);
        });
        
        // 为每个有记录的日期重新标记状态
        dateRecordCounts.forEach((count, date) => {
            const { month, day } = DateUtils.parseDate(date);
            if (month && day) {
                this.circleRenderer.markDateAsRecorded(month, day);
            }
        });
    }

    /**
     * 获取应用状态
     * @returns {Object} 应用状态
     */
    getAppState() {
        return {
            ...this.appState,
            currentYear: this.currentYear,
            isInitialized: this.isInitialized,
            recordCount: this.recordManager?.getAllRecords().length || 0
        };
    }

    /**
     * 销毁应用
     */
    destroy() {
        // 保存数据
        if (this.appState.hasUnsavedChanges) {
            this.saveData();
        }
        
        // 销毁各模块
        if (this.interactionHandler) {
            this.interactionHandler.destroy();
        }
        
        // 清理全局引用
        window.storageManager = null;
        window.circleRenderer = null;
        window.recordManager = null;
        window.interactionHandler = null;
        window.exportManager = null;
        
    }
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    // 创建全局应用实例
    window.yearCircleApp = new YearCircleApp();
    window.app = window.yearCircleApp; // 为 FileStorageManager 提供访问接口
    
    // 启动应用
    window.yearCircleApp.init().catch(error => {
        alert('应用启动失败，请刷新页面重试');
    });
});

// 导出应用类
window.YearCircleApp = YearCircleApp;