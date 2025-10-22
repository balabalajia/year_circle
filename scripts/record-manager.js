/**
 * 记录管理器
 * 负责记录的创建、编辑、删除和渲染
 */

class RecordManager {
    constructor(containerElement) {
        this.container = containerElement;
        this.records = new Map(); // key: recordId, value: record object
        this.currentYear = new Date().getFullYear();
        this.selectedRecord = null;
        
        // 默认记录尺寸
        this.defaultSize = {
            text: { width: 200, height: 120 },
            image: { width: 250, height: 200 }
        };
        
        // 记录计数器
        this.recordCounter = 0;
        
        // 连接线绘制防抖
        this.connectionLineDebounceMap = new Map(); // 存储每个记录的防抖定时器
    }

    /**
     * 创建新记录
     * @param {Object} recordData - 记录数据
     * @returns {string} 记录ID
     */
    createRecord(recordData) {
        const recordId = generateId('record');
        
        const record = {
            id: recordId,
            date: recordData.date,
            type: recordData.type,
            content: recordData.content,
            position: recordData.position || this.getDefaultPosition(),
            size: recordData.size || this.defaultSize[recordData.type],
            borderColor: recordData.borderColor || 'classic', // 添加边框颜色字段，默认为经典色
            connectionLine: recordData.connectionLine || {
                isCustom: false,  // 是否为自定义连接线
                segments: []      // 连接线段数据，每段包含 {type: 'horizontal'|'vertical', offset: number}
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.records.set(recordId, record);
        this.renderRecord(record);
        this.updateDateStatus(record.date, true);
        
        return recordId;
    }

    /**
     * 渲染记录卡片 - V1.2更新：简化显示样式，移除编辑删除按钮和日期显示
     * @param {Object} record - 记录对象
     * @param {boolean} drawConnectionLine - 是否绘制连接线，默认为true
     */
    renderRecord(record, drawConnectionLine = true) {
        // 创建记录卡片容器
        const cardElement = DOMUtils.createElement('div', {
            className: 'record-card',
            'data-record-id': record.id,
            'data-record-type': record.type
        });

        // 设置位置和尺寸
        cardElement.style.left = `${record.position.x}px`;
        cardElement.style.top = `${record.position.y}px`;
        cardElement.style.width = `${record.size.width}px`;
        cardElement.style.height = `${record.size.height}px`;
        
        // 应用边框颜色样式
        this.applyBorderColor(cardElement, record.borderColor);

        // V1.2更新：仅创建记录内容，移除头部（编辑删除按钮和日期显示）
        const content = this.createRecordContent(record);
        cardElement.appendChild(content);

        // 创建缩放手柄
        const resizeHandle = this.createResizeHandle(record);
        cardElement.appendChild(resizeHandle);

        // 添加事件监听
        this.attachRecordEvents(cardElement, record);

        // 添加到容器
        this.container.appendChild(cardElement);

        // 更新尺寸类
        this.updateSizeClass(record.id);

        // 根据参数决定是否绘制连接线
        if (drawConnectionLine) {
            this.drawConnectionLine(record, true);
        }

        // 添加动画效果
        cardElement.classList.add('fade-in');
    }

    /**
     * V1.2更新：移除记录头部功能
     * 原createRecordHeader方法已废弃，因为V1.2版本移除了编辑删除按钮和日期显示
     * 编辑删除功能将通过右键上下文菜单实现
     */
    // createRecordHeader方法已在V1.2版本中移除

    /**
     * 应用边框颜色样式
     * @param {HTMLElement} cardElement - 记录卡片元素
     * @param {string} borderColor - 边框颜色类型
     */
    applyBorderColor(cardElement, borderColor) {
        // 如果没有指定边框颜色，使用默认的classic
        const actualBorderColor = borderColor || 'classic';
        
        // 移除所有边框颜色类
        const borderColorClasses = ['border-classic', 'border-warm', 'border-fresh', 'border-elegant', 'border-soft'];
        cardElement.classList.remove(...borderColorClasses);
        
        // 添加对应的边框颜色类
        const borderColorClass = `border-${actualBorderColor}`;
        cardElement.classList.add(borderColorClass);
        
        // 设置CSS自定义属性，用于更精确的样式控制
        const colorMap = {
            'classic': 'var(--border-color-classic)',
            'warm': 'var(--border-color-warm)',
            'fresh': 'var(--border-color-fresh)',
            'elegant': 'var(--border-color-elegant)',
            'soft': 'var(--border-color-soft)'
        };
        
        const colorValue = colorMap[actualBorderColor] || colorMap['classic'];
        cardElement.style.setProperty('--record-border-color', colorValue);
    }

    /**
     * 创建记录内容
     * @param {Object} record - 记录对象
     * @returns {HTMLElement} 内容元素
     */
    createRecordContent(record) {
        const content = DOMUtils.createElement('div', { 
            className: `record-content ${record.type}-content` 
        });

        if (record.type === 'text') {
            content.textContent = record.content;
        } else if (record.type === 'image') {
            const img = DOMUtils.createElement('img', {
                src: record.content.imageData,
                alt: record.content.description || '记录图片'
            });
            content.appendChild(img);

            if (record.content.description) {
                const description = DOMUtils.createElement('div', {
                    className: 'image-description'
                }, record.content.description);
                content.appendChild(description);
            }
        }

        return content;
    }

    /**
     * 创建缩放手柄 - V1.2更新：支持多方向调节
     * @param {Object} record - 记录对象
     * @returns {DocumentFragment} 包含多个缩放手柄的文档片段
     */
    createResizeHandle(record) {
        const fragment = document.createDocumentFragment();
        
        // 创建三个方向的缩放手柄
        const directions = [
            { class: 'se', title: '调节大小' },
            { class: 'e', title: '调节宽度' },
            { class: 's', title: '调节高度' }
        ];
        
        directions.forEach(dir => {
            const handle = DOMUtils.createElement('div', { 
                className: `resize-handle ${dir.class}`,
                'data-record-id': record.id,
                'data-direction': dir.class,
                title: dir.title
            });
            fragment.appendChild(handle);
        });
        
        return fragment;
    }

    /**
     * 为记录卡片添加事件监听
     * @param {HTMLElement} cardElement - 卡片元素
     * @param {Object} record - 记录对象
     */
    attachRecordEvents(cardElement, record) {
        // 鼠标进入事件
        cardElement.addEventListener('mouseenter', () => {
            this.highlightRecord(record.id);
        });

        // 鼠标离开事件
        cardElement.addEventListener('mouseleave', () => {
            this.unhighlightRecord(record.id);
        });

        // 点击选中事件
        cardElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectRecord(record.id);
        });

        // 双击编辑事件
        cardElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editRecord(record.id);
        });
    }

    /**
     * 获取默认位置
     * @returns {Object} 默认位置 {x, y}
     */
    getDefaultPosition() {
        const containerRect = this.container.getBoundingClientRect();
        const margin = 50;
        
        // 简单的位置分布算法，避免重叠
        const baseX = margin + (this.recordCounter % 3) * 220;
        const baseY = margin + Math.floor(this.recordCounter / 3) * 140;
        
        this.recordCounter++;
        
        return {
            x: Math.min(baseX, containerRect.width - 250),
            y: Math.min(baseY, containerRect.height - 200)
        };
    }

    /**
     * 更新记录
     * @param {string} recordId - 记录ID
     * @param {Object} updateData - 更新数据
     */
    updateRecord(recordId, updateData) {
        const record = this.records.get(recordId);
        if (!record) {
            return;
        }

        // 更新记录数据
        Object.assign(record, updateData, {
            updatedAt: new Date().toISOString()
        });

        // 重新渲染记录
        this.removeRecordElement(recordId);
        this.renderRecord(record);
    }

    /**
     * 删除记录
     * @param {string} recordId - 记录ID
     */
    deleteRecord(recordId) {
        const record = this.records.get(recordId);
        if (!record) {
            return;
        }

        // 确认删除
        if (!confirm('确定要删除这条记录吗？')) {
            return;
        }

        // 触发记录删除事件 - 修复连接线和控制手柄清理问题
        const deleteEvent = new CustomEvent('recordDeleted', {
            detail: {
                recordId,
                record
            }
        });
        document.dispatchEvent(deleteEvent);

        // 移除DOM元素
        this.removeRecordElement(recordId);
        
        // 移除连接线
        this.removeConnectionLine(recordId);
        
        // 从记录集合中删除
        this.records.delete(recordId);
        
        // 更新日期状态
        this.updateDateStatus(record.date, false);
    }

    /**
     * 移除记录DOM元素
     * @param {string} recordId - 记录ID
     */
    removeRecordElement(recordId) {
        const element = this.container.querySelector(`[data-record-id="${recordId}"]`);
        if (element) {
            element.remove();
        }
    }

    /**
     * 编辑记录
     * @param {string} recordId - 记录ID
     */
    editRecord(recordId) {
        const record = this.records.get(recordId);
        if (!record) {
            return;
        }

        // 触发编辑事件
        const editEvent = new CustomEvent('recordEdit', {
            detail: { record: record }
        });
        document.dispatchEvent(editEvent);
    }

    /**
     * 选中记录
     * @param {string} recordId - 记录ID
     */
    selectRecord(recordId) {
        // 清除之前的选中状态
        if (this.selectedRecord) {
            const prevElement = this.container.querySelector(`[data-record-id="${this.selectedRecord}"]`);
            if (prevElement) {
                prevElement.classList.remove('selected');
            }
            
            // 触发记录取消选中事件 - V1.5新增
            const deselectEvent = new CustomEvent('recordDeselected', {
                detail: { recordId: this.selectedRecord }
            });
            document.dispatchEvent(deselectEvent);
        }

        // 设置新的选中状态
        this.selectedRecord = recordId;
        const element = this.container.querySelector(`[data-record-id="${recordId}"]`);
        if (element) {
            element.classList.add('selected');
        }
        
        // 触发记录选中事件 - V1.5新增
        const selectEvent = new CustomEvent('recordSelected', {
            detail: { recordId: recordId }
        });
        document.dispatchEvent(selectEvent);
    }

    /**
     * 高亮记录
     * @param {string} recordId - 记录ID
     */
    highlightRecord(recordId) {
        // 高亮连接线
        if (window.circleRenderer) {
            window.circleRenderer.highlightConnectionLine(recordId);
        }
    }

    /**
     * 取消高亮记录
     * @param {string} recordId - 记录ID
     */
    unhighlightRecord(recordId) {
        // 取消高亮连接线
        if (window.circleRenderer) {
            window.circleRenderer.unhighlightConnectionLine(recordId);
        }
    }

    /**
     * 绘制连接线（带防抖机制）
     * @param {Object} record - 记录对象
     * @param {boolean} immediate - 是否立即执行，默认false
     */
    drawConnectionLine(record, immediate = false, customPosition = null) {
        
        if (!window.circleRenderer) {
            console.warn(`[RecordManager] circleRenderer不存在，无法绘制连接线`);
            return;
        }

        // 清除之前的防抖定时器
        if (this.connectionLineDebounceMap.has(record.id)) {
            clearTimeout(this.connectionLineDebounceMap.get(record.id));
        }

        // 实际绘制连接线的函数
        const drawLine = () => {

            
            let relativeX, relativeY;
            let cardWidth, cardHeight;
            
            if (customPosition) {
                // 使用传入的自定义位置
                relativeX = customPosition.x;
                relativeY = customPosition.y;
                
                // 拖拽时直接使用记录对象中保存的尺寸信息，避免DOM查询的不准确性
                cardWidth = record.size?.width || 200;
                cardHeight = record.size?.height || 150;
                
            } else {
                // 获取记录元素的实际位置
                const cardElement = document.querySelector(`[data-record-id="${record.id}"]`);
                if (!cardElement) {
                    console.warn(`[RecordManager] 未找到DOM元素: ${record.id}`);
                    return;
                }

                // 获取画布容器的位置
                const canvasContainer = document.getElementById('year-circle-canvas');
                if (!canvasContainer) {
                    console.warn(`[RecordManager] 未找到画布容器`);
                    return;
                }

                // 计算相对于画布容器的位置
                const cardRect = cardElement.getBoundingClientRect();
                const canvasRect = canvasContainer.getBoundingClientRect();
                
                relativeX = cardRect.left - canvasRect.left;
                relativeY = cardRect.top - canvasRect.top;

                // 优先使用记录数据中的尺寸，这是连接线计算的正确基准
                // DOM的实际尺寸可能包含CSS缩放等影响，不适合用于连接线计算
                cardWidth = record.size?.width || 200; // 默认宽度
                cardHeight = record.size?.height || 150; // 默认高度
                
                
                // 如果记录数据中没有尺寸信息，才使用DOM尺寸作为备选
                if (!record.size?.width || !record.size?.height) {
                    
                    const domWidth = cardRect.width;
                    const domHeight = cardRect.height;
                    
                    // 如果DOM尺寸有效，使用DOM尺寸
                    if (domWidth > 0 && domHeight > 0) {
                        cardWidth = domWidth;
                        cardHeight = domHeight;
                    } else {
                        // 尝试其他方式获取尺寸
                        cardWidth = cardElement.offsetWidth || cardWidth;
                        cardHeight = cardElement.offsetHeight || cardHeight;
                        
                        if (cardWidth === 0 || cardHeight === 0) {
                            const computedStyle = window.getComputedStyle(cardElement);
                            cardWidth = parseFloat(computedStyle.width) || cardWidth;
                            cardHeight = parseFloat(computedStyle.height) || cardHeight;
                        }
                    }
                }
            }

            // 验证连接线数据的有效性
            let connectionLineData = null;

            
            if (record.connectionLine && record.connectionLine.isCustom) {
                const isValid = this.validateConnectionLineData(record.connectionLine, record.id);
                if (isValid) {
                    connectionLineData = record.connectionLine;
                } else {                    // 清理无效的连接线数据
                    delete record.connectionLine;
                    record.updatedAt = new Date().toISOString();
                    
                    // 触发自动保存
                    if (window.storageManager) {
                        window.storageManager.triggerAutoSave();
                    }
                }
            } 

            const { year, month, day } = DateUtils.parseDate(record.date);
            
            const positionData = {
                x: relativeX,
                y: relativeY,
                width: cardWidth,
                height: cardHeight
            };

            
            window.circleRenderer.drawConnectionLine(
                record.id, 
                month, 
                day, 
                positionData,
                connectionLineData // 只传递验证过的连接线数据，无效数据会被设为null
            );


            // 清除防抖定时器
            this.connectionLineDebounceMap.delete(record.id);
        };

        if (immediate) {
            // 立即执行
            drawLine();
        } else {
            // 防抖执行（50ms延迟）
            const timeoutId = setTimeout(drawLine, 50);
            this.connectionLineDebounceMap.set(record.id, timeoutId);
        }
    }

    /**
     * 移除连接线
     * @param {string} recordId - 记录ID
     */
    removeConnectionLine(recordId) {
        if (window.circleRenderer) {
            window.circleRenderer.removeConnectionLine(recordId);
        }
    }

    /**
     * 更新日期状态
     * @param {string} date - 日期字符串
     * @param {boolean} hasRecord - 是否有记录
     */
    updateDateStatus(date, hasRecord) {
        if (!window.circleRenderer) return;

        const { month, day } = DateUtils.parseDate(date);
        
        if (hasRecord) {
            window.circleRenderer.markDateAsRecorded(month, day);
            
            // 触发记录创建事件
            const event = new CustomEvent('recordCreated', {
                detail: { date, month, day }
            });
            document.dispatchEvent(event);
        } else {
            // 检查该日期是否还有其他记录
            const hasOtherRecords = Array.from(this.records.values())
                .some(record => record.date === date);
            
            if (!hasOtherRecords) {
                window.circleRenderer.unmarkDateAsRecorded(month, day);
                
                // 触发记录删除事件
                const event = new CustomEvent('recordDeleted', {
                    detail: { date, month, day }
                });
                document.dispatchEvent(event);
            }
        }
    }

    /**
     * 更新记录位置
     * @param {string} recordId - 记录ID
     * @param {Object} newPosition - 新位置 {x, y}
     * @param {boolean} isDragging - 是否正在拖拽中，默认false
     */
    updateRecordPosition(recordId, newPosition, isDragging = false) {
        const record = this.records.get(recordId);

        // 保存旧位置用于连接线调整
        const oldPosition = { ...record.position };
        
        record.position = { ...record.position, ...newPosition };
        record.updatedAt = new Date().toISOString();
        
        // 如果拖拽结束，重置连接线到默认状态（去掉所有自定义调整）
        if (!isDragging) {
            this.resetConnectionLineToDefault(record);
        }
        
        // 触发记录位置变化事件 - 修复连接线拖拽问题
        const positionChangeEvent = new CustomEvent('recordPositionChanged', {
            detail: {
                recordId,
                newPosition,
                isDragging,
                record
            }
        });
        
        document.dispatchEvent(positionChangeEvent);
        
        // 根据是否在拖拽中选择不同的连接线更新策略
        if (isDragging) {
            // 拖拽过程中使用防抖机制，避免频繁重绘
            this.drawConnectionLine(record, false, newPosition);
        } else {
            // 非拖拽状态（如拖拽结束）立即更新连接线
            this.drawConnectionLine(record, true, newPosition);
        }

        // 触发自动保存
        if (window.storageManager) {
            window.storageManager.triggerAutoSave();
        }
    }

    /**
     * 重置连接线到默认状态（移除所有自定义调整）
     * @param {Object} record - 记录对象
     */
    resetConnectionLineToDefault(record) {
        if (record.connectionLine?.isCustom) {            
            // 移除自定义连接线数据
            delete record.connectionLine;
            
            // 触发连接线重置事件，通知连接线调整器清理控制手柄
            const resetEvent = new CustomEvent('connectionLineReset', {
                detail: {
                    recordId: record.id
                }
            });
            document.dispatchEvent(resetEvent);
        }
    }

    /**
     * 更新连接线数据中的路径点以适应记录的新位置
     * @param {Object} record - 记录对象
     * @param {Object} oldPosition - 旧位置
     * @param {Object} newPosition - 新位置
     */
    updateConnectionLineDataForNewPosition(record, oldPosition, newPosition) {
        if (!record.connectionLine?.pathPoints || record.connectionLine.pathPoints.length === 0) {
            return;
        }

        // 计算位置偏移量
        const deltaX = newPosition.x - oldPosition.x;
        const deltaY = newPosition.y - oldPosition.y;

        // 更新路径点坐标（除了第一个点，它是日期小点）
        record.connectionLine.pathPoints = record.connectionLine.pathPoints.map((point, index) => {
            if (index === 0) {
                // 第一个点是日期小点，不需要调整
                return { ...point };
            }
            
            // 其他点需要根据记录位置偏移进行调整
            const updatedPoint = {
                x: point.x + deltaX,
                y: point.y + deltaY
            };
            
            return updatedPoint;
        });

        // 更新最后修改时间
        record.connectionLine.lastModified = new Date().toISOString();
        
    }

    /**
     * 更新记录尺寸
     * @param {string} recordId - 记录ID
     * @param {Object} newSize - 新尺寸 {width, height}
     * @param {boolean} redrawConnectionLine - 是否重绘连接线，默认为true
     */
    updateRecordSize(recordId, newSize, redrawConnectionLine = true) {
        const record = this.records.get(recordId);
        if (!record) return;

        record.size = { ...record.size, ...newSize };
        record.updatedAt = new Date().toISOString();

        // 更新尺寸类
        this.updateSizeClass(recordId);

        // 根据参数决定是否重绘连接线
        if (redrawConnectionLine) {
            // 传递当前记录位置作为customPosition，避免DOM查询的不准确性
            // 这样确保使用记录数据中保存的位置和尺寸，而不是DOM的实际渲染状态
            this.drawConnectionLine(record, true, record.position);
        }

        // 触发自动保存
        if (window.storageManager) {
            window.storageManager.triggerAutoSave();
        }
    }

    /**
     * 根据记录尺寸更新CSS类
     * @param {string} recordId - 记录ID
     */
    updateSizeClass(recordId) {
        const record = this.records.get(recordId);
        if (!record) return;

        const cardElement = document.querySelector(`[data-record-id="${recordId}"]`);
        if (!cardElement) return;

        // 移除现有的尺寸类
        cardElement.classList.remove('size-small', 'size-tiny');

        const { width, height } = record.size;

        // 根据尺寸添加相应的类
        if (width <= 100 || height <= 80) {
            cardElement.classList.add('size-small');
        }
        if (width <= 90 || height <= 70) {
            cardElement.classList.add('size-tiny');
        }
    }

    /**
     * 获取指定ID的记录
     * @param {string} recordId - 记录ID
     * @returns {Object|null} 记录对象或null
     */
    getRecord(recordId) {
        return this.records.get(recordId) || null;
    }

    /**
     * 获取指定日期的记录
     * @param {string} date - 日期字符串
     * @returns {Array} 记录数组
     */
    getRecordsByDate(date) {
        return Array.from(this.records.values())
            .filter(record => record.date === date);
    }

    /**
     * 获取所有记录
     * @returns {Array} 记录数组
     */
    getAllRecords() {
        return Array.from(this.records.values());
    }

    /**
     * 清空所有记录
     */
    clearAllRecords() {
        // 移除所有DOM元素
        this.container.innerHTML = '';
        
        // 清空记录集合
        this.records.clear();
        
        // 重置计数器
        this.recordCounter = 0;
        this.selectedRecord = null;
    }

    /**
     * 加载记录数据
     * @param {Array} recordsData - 记录数据数组
     */
    loadRecords(recordsData) {
        this.clearAllRecords();
        
        // 第一步：加载所有记录到内存中
        recordsData.forEach(recordData => {
            const record = {
                ...recordData,
                updatedAt: new Date().toISOString()
            };
            
            this.records.set(record.id, record);
        });
        
        // 第二步：清理无效的连接线数据
        this.cleanupInvalidConnectionLines();
        
        // 第三步：渲染所有记录，但不绘制连接线（避免时序问题）
        this.records.forEach(record => {
            this.renderRecord(record, false); // 不绘制连接线
            this.updateDateStatus(record.date, true);
        });
    }

    /**
     * 绘制所有记录的连接线
     * 用于在圆环渲染完成后统一绘制连接线
     */
    drawAllConnectionLines() {
        
        if (!window.circleRenderer) {
            console.warn(`[RecordManager] circleRenderer不存在，无法绘制连接线`);
            return;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        this.records.forEach(record => {
            try {
                this.drawConnectionLine(record, true);
                successCount++;
            } catch (error) {
                console.error(`[RecordManager] 绘制记录 ${record.id} 的连接线失败:`, error);
                failCount++;
            }
        });
        
    }

    /**
     * 清理无效的连接线数据
     * 检查连接线是否引用了不存在的记录，如果是则移除连接线数据
     */
    cleanupInvalidConnectionLines() {
        let cleanedCount = 0;
        
        this.records.forEach((record, recordId) => {
            // 检查记录是否有自定义连接线数据
            if (record.connectionLine && record.connectionLine.isCustom) {
                
                // 检查连接线数据的有效性
                const isValid = this.validateConnectionLineData(record.connectionLine, recordId);
                
                if (!isValid) {
                    delete record.connectionLine;
                    record.updatedAt = new Date().toISOString();
                    cleanedCount++;
                }
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`[RecordManager] 已清理 ${cleanedCount} 个无效的连接线数据`);
            
            // 触发自动保存以持久化清理结果
            if (window.storageManager) {
                window.storageManager.triggerAutoSave();
            }
        } 
    }

    /**
     * 验证连接线数据的有效性
     * @param {Object} connectionLineData - 连接线数据
     * @param {string} recordId - 当前记录ID
     * @returns {boolean} 连接线数据是否有效
     */
    validateConnectionLineData(connectionLineData, recordId) {
        // 基本数据结构检查
        if (!connectionLineData || typeof connectionLineData !== 'object') {
            return false;
        }
        
        // 检查是否有路径点数据
        if (!connectionLineData.pathPoints || !Array.isArray(connectionLineData.pathPoints)) {
            return false;
        }
        
        // 检查路径点数量（至少需要2个点：起点和终点）
        if (connectionLineData.pathPoints.length < 2) {
            return false;
        }
        
        // 检查路径点数据格式
        for (let i = 0; i < connectionLineData.pathPoints.length; i++) {
            const point = connectionLineData.pathPoints[i];
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                return false;
            }
        }
        
        // 如果有其他特定的验证规则，可以在这里添加
        // 例如：检查连接线是否引用了其他记录，验证这些记录是否仍然存在
        
        return true;
    }

    /**
     * 导出记录数据
     * @returns {Array} 记录数据数组
     */
    exportRecords() {
        return this.getAllRecords();
    }

    /**
     * 获取记录统计信息
     * @returns {Object} 统计信息
     */
    getStatistics() {
        const records = this.getAllRecords();
        const textRecords = records.filter(r => r.type === 'text');
        const imageRecords = records.filter(r => r.type === 'image');
        
        // 按月份统计
        const monthlyStats = {};
        records.forEach(record => {
            const { month } = DateUtils.parseDate(record.date);
            monthlyStats[month] = (monthlyStats[month] || 0) + 1;
        });

        return {
            total: records.length,
            textRecords: textRecords.length,
            imageRecords: imageRecords.length,
            monthlyStats: monthlyStats,
            oldestRecord: records.reduce((oldest, record) => 
                !oldest || record.createdAt < oldest.createdAt ? record : oldest, null),
            newestRecord: records.reduce((newest, record) => 
                !newest || record.createdAt > newest.createdAt ? record : newest, null)
        };
    }
}

// 导出到全局
window.RecordManager = RecordManager;