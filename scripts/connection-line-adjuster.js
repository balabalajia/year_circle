/**
 * 连接线调整管理器 - V1.5重新设计
 * 负责连接线位置的手动调整功能，实现线段中点控制和横平竖直约束
 * 
 * 核心功能：
 * 1. 为每个线段的中点生成控制手柄
 * 2. 竖直线段只能水平拖拽，水平线段只能垂直拖拽
 * 3. 拖拽时整条线段移动，相邻线段长度同步调整
 * 4. 保持所有线段的横平竖直特性
 */

class ConnectionLineAdjuster {
    constructor(svg) {
        this.svg = svg;
        this.selectedRecordId = null;
        this.isDragging = false;
        this.dragTarget = null;
        this.originalPathPoints = null;
        
        // 创建控制手柄组
        this.handlesGroup = this.createHandlesGroup();
        
        // 绑定事件监听器
        this.bindEvents();
    }

    /**
     * 创建控制手柄组
     * @returns {SVGElement} 控制手柄组元素
     */
    createHandlesGroup() {
        let handlesGroup = this.svg.querySelector('#connection-handles-group');
        if (!handlesGroup) {
            handlesGroup = DOMUtils.createSVGElement('g', {
                id: 'connection-handles-group',
                class: 'connection-handles-group'
            });
            this.svg.appendChild(handlesGroup);
        }
        return handlesGroup;
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 监听记录选中事件
        document.addEventListener('recordSelected', (event) => {
            this.showControlHandles(event.detail.recordId);
        });

        // 监听记录取消选中事件
        document.addEventListener('recordDeselected', () => {
            this.hideControlHandles();
        });

        // 监听记录位置变化事件 - 修复拖拽时连接线断开问题
        document.addEventListener('recordPositionChanged', (event) => {
            this.handleRecordPositionChange(event);
        });

        // 监听记录删除事件 - 修复删除记录时控制手柄残留问题
        document.addEventListener('recordDeleted', (event) => {
            this.handleRecordDeleted(event.detail.recordId);
        });

        // 监听连接线重置事件 - 清理控制手柄
        document.addEventListener('connectionLineReset', (event) => {
            this.handleConnectionLineReset(event.detail.recordId);
        });
    }

    /**
     * 处理连接线重置事件
     * @param {string} recordId - 记录ID
     */
    handleConnectionLineReset(recordId) {
        
        // 如果是当前选中的记录，隐藏控制手柄
        if (this.selectedRecordId === recordId) {
            this.hideControlHandles();
        }
    }

    /**
     * 处理记录删除事件
     * @param {string} recordId - 被删除的记录ID
     */
    handleRecordDeleted(recordId) {
        // 如果被删除的记录正是当前选中的记录，清理控制手柄
        if (this.selectedRecordId === recordId) {
            this.hideControlHandles();
            this.selectedRecordId = null;
        }
    }

    /**
     * 处理记录位置变化事件
     * @param {CustomEvent} event - 位置变化事件
     */
    handleRecordPositionChange(event) {
        // 安全检查事件对象和detail属性
        if (!event || !event.detail) {
            return;
        }
        
        const { recordId, newPosition, isDragging } = event.detail;

        
        // 如果当前选中的记录正在被拖拽，需要更新连接线和控制手柄
        if (this.selectedRecordId === recordId && isDragging) {            
            // 重新绘制连接线到新位置
            this.updateConnectionLineForDrag(recordId, newPosition);
            
            // 更新控制手柄位置
            this.updateControlHandlesPosition(recordId);
        }
    }

    /**
     * 为拖拽更新连接线位置
     * @param {string} recordId - 记录ID
     * @param {Object} newPosition - 新位置 {x, y}
     */
    updateConnectionLineForDrag(recordId, newPosition) {
        const record = window.recordManager?.getRecord(recordId);

        // 获取日期信息
        const { month, day } = DateUtils.parseDate(record.date);
        
        // 如果有自定义连接线数据，需要重新计算路径点以适应新位置
        let connectionLineData = null;
        if (record.connectionLine?.isCustom && record.connectionLine.pathPoints) {
            connectionLineData = this.adjustConnectionLineForNewPosition(
                record.connectionLine, 
                record.position, 
                newPosition
            );
        }
        
        // 重新绘制连接线到新位置
        if (window.circleRenderer) {
            window.circleRenderer.drawConnectionLine(
                recordId, 
                month, 
                day, 
                newPosition, 
                connectionLineData
            );
        } 
    }

    /**
     * 调整连接线路径点以适应记录的新位置
     * @param {Object} originalConnectionLine - 原始连接线数据
     * @param {Object} oldPosition - 记录的旧位置
     * @param {Object} newPosition - 记录的新位置
     * @returns {Object} 调整后的连接线数据
     */
    adjustConnectionLineForNewPosition(originalConnectionLine, oldPosition, newPosition) {
        if (!originalConnectionLine.pathPoints || originalConnectionLine.pathPoints.length === 0) {
            return originalConnectionLine;
        }

        // 计算位置偏移量
        const deltaX = newPosition.x - oldPosition.x;
        const deltaY = newPosition.y - oldPosition.y;

        // 复制原始路径点并调整坐标
        const adjustedPathPoints = originalConnectionLine.pathPoints.map((point, index) => {
            // 第一个点是日期小点，不需要调整
            if (index === 0) {
                return { ...point };
            }
            
            // 其他点需要根据记录位置偏移进行调整
            const adjustedPoint = {
                x: point.x + deltaX,
                y: point.y + deltaY
            };
            
            return adjustedPoint;
        });

        // 返回调整后的连接线数据
        const result = {
            ...originalConnectionLine,
            pathPoints: adjustedPathPoints
        };
        
        return result;
    }

    /**
     * 更新控制手柄位置
     * @param {string} recordId - 记录ID
     */
    updateControlHandlesPosition(recordId) {
        // 获取更新后的连接线
        const connectionLine = window.circleRenderer.connectionsGroup
            .querySelector(`[data-record-id="${recordId}"]`);
        
        if (!connectionLine) return;

        // 解析新的路径数据
        const pathData = connectionLine.getAttribute('d');
        if (!pathData) return;
        
        const pathPoints = this.parsePathData(pathData);
        if (pathPoints.length < 2) return;

        // 清除现有控制手柄
        this.hideControlHandles();
        
        // 重新创建控制手柄
        this.createSegmentControlHandles(pathPoints, recordId);
    }

    /**
     * 显示连接线控制手柄
     * @param {string} recordId - 记录ID
     */
    showControlHandles(recordId) {
        this.selectedRecordId = recordId;
        this.hideControlHandles(); // 先清除现有手柄

        const connectionLine = window.circleRenderer.connectionsGroup
            .querySelector(`[data-record-id="${recordId}"]`);
        
        if (!connectionLine) {
            return;
        }

        // 解析连接线路径
        const pathData = connectionLine.getAttribute('d');
        
        if (!pathData) {
            return;
        }
        
        const pathPoints = this.parsePathData(pathData);
        
        if (pathPoints.length < 2) {
            return;
        }

        // 保存原始路径点（用于拖拽计算）
        this.originalPathPoints = [...pathPoints];
        
        // 为每个线段的中点创建控制手柄
        this.createSegmentControlHandles(pathPoints, recordId);

    }

    /**
     * 为每个线段的中点创建控制手柄
     * @param {Array} pathPoints - 路径点数组
     * @param {string} recordId - 记录ID
     */
    createSegmentControlHandles(pathPoints, recordId) {
        // 遍历每个线段，为其中点创建控制手柄
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const startPoint = pathPoints[i];
            const endPoint = pathPoints[i + 1];
            
            // 计算线段中点
            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2;
            
            // 判断线段方向
            const isHorizontal = Math.abs(startPoint.y - endPoint.y) < 5;
            const isVertical = Math.abs(startPoint.x - endPoint.x) < 5;
            
            // 创建控制手柄
            const handle = this.createControlHandle(midX, midY, i, recordId, isHorizontal, isVertical);
            this.handlesGroup.appendChild(handle);
            
        }
    }

    /**
     * 隐藏控制手柄
     */
    hideControlHandles() {
        this.handlesGroup.innerHTML = '';
        this.selectedRecordId = null;
        this.originalPathPoints = null;
    }

    /**
     * 创建单个控制手柄
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} segmentIndex - 线段索引
     * @param {string} recordId - 记录ID
     * @param {boolean} isHorizontal - 是否为水平线段
     * @param {boolean} isVertical - 是否为垂直线段
     * @returns {SVGElement} 控制手柄元素
     */
    createControlHandle(x, y, segmentIndex, recordId, isHorizontal, isVertical) {
        const handle = DOMUtils.createSVGElement('rect', {
            x: x - 4,
            y: y - 4,
            width: 8,
            height: 8,
            class: 'connection-handle',
            'data-record-id': recordId,
            'data-segment-index': segmentIndex,
            'data-is-horizontal': isHorizontal,
            'data-is-vertical': isVertical,
            style: 'cursor: ' + (isHorizontal ? 'ns-resize' : isVertical ? 'ew-resize' : 'move')
        });

        this.attachHandleDragEvents(handle);
        return handle;
    }

    /**
     * 为控制手柄绑定拖拽事件
     * @param {SVGElement} handle - 控制手柄元素
     */
    attachHandleDragEvents(handle) {
        handle.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            this.isDragging = true;
            this.dragTarget = handle;
            
            const recordId = handle.getAttribute('data-record-id');
            const segmentIndex = parseInt(handle.getAttribute('data-segment-index'));
            const isHorizontal = handle.getAttribute('data-is-horizontal') === 'true';
            const isVertical = handle.getAttribute('data-is-vertical') === 'true';

            const onMouseMove = (moveEvent) => {
                if (!this.isDragging || !this.dragTarget) return;

                // 获取鼠标在SVG中的坐标
                const svgRect = this.svg.getBoundingClientRect();
                const mouseX = moveEvent.clientX - svgRect.left;
                const mouseY = moveEvent.clientY - svgRect.top;
                
                // 应用拖拽约束
                let constrainedX = mouseX;
                let constrainedY = mouseY;
                
                if (isHorizontal) {
                    // 水平线段：只能垂直拖拽（上下移动）
                    constrainedX = parseFloat(handle.getAttribute('x')) + 4; // 保持X坐标不变
                } else if (isVertical) {
                    // 垂直线段：只能水平拖拽（左右移动）
                    constrainedY = parseFloat(handle.getAttribute('y')) + 4; // 保持Y坐标不变
                }
                
                // 更新控制手柄位置
                handle.setAttribute('x', constrainedX - 4);
                handle.setAttribute('y', constrainedY - 4);
                
                // 实时更新连接线路径
                this.updateConnectionPath(recordId, segmentIndex, constrainedX, constrainedY, isHorizontal, isVertical);
            };

            const onMouseUp = () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    this.dragTarget = null;
                    
                    // 保存调整后的连接线数据
                    this.saveConnectionLineAdjustment(recordId);
                    
                    console.log('拖拽结束，保存连接线调整');
                }
                
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * 更新连接线路径
     * @param {string} recordId - 记录ID
     * @param {number} segmentIndex - 被拖拽的线段索引
     * @param {number} newX - 新的X坐标
     * @param {number} newY - 新的Y坐标
     * @param {boolean} isHorizontal - 是否为水平线段
     * @param {boolean} isVertical - 是否为垂直线段
     */
    updateConnectionPath(recordId, segmentIndex, newX, newY, isHorizontal, isVertical) {
        const connectionLine = window.circleRenderer.connectionsGroup
            .querySelector(`[data-record-id="${recordId}"]`);
        
        if (!connectionLine || !this.originalPathPoints) {
            console.log('updateConnectionPath: 缺少必要参数');
            return;
        }

        // 复制原始路径点进行修改
        let pathPoints = [...this.originalPathPoints];
        
        if (segmentIndex >= 0 && segmentIndex < pathPoints.length - 1) {
            const startPoint = pathPoints[segmentIndex];
            const endPoint = pathPoints[segmentIndex + 1];
            
            if (isHorizontal) {
                // 水平线段：移动整条水平线的Y坐标，调整相邻垂直线段的长度
                const deltaY = newY - startPoint.y;
                
                // 移动水平线段的两个端点的Y坐标
                pathPoints[segmentIndex].y = newY;
                pathPoints[segmentIndex + 1].y = newY;
                
            } else if (isVertical) {
                // 垂直线段：移动整条垂直线的X坐标，调整相邻水平线段的长度
                const deltaX = newX - startPoint.x;
                
                // 移动垂直线段的两个端点的X坐标
                pathPoints[segmentIndex].x = newX;
                pathPoints[segmentIndex + 1].x = newX;
     
            }
            
            // 重新生成路径并应用
            const newPath = this.generatePathFromPoints(pathPoints);
            connectionLine.setAttribute('d', newPath);
        }
    }

    /**
     * 保存连接线调整数据
     * @param {string} recordId - 记录ID
     */
    saveConnectionLineAdjustment(recordId) {
        const connectionLine = window.circleRenderer.connectionsGroup
            .querySelector(`[data-record-id="${recordId}"]`);
        
        if (!connectionLine) return;

        // 获取当前路径数据
        const currentPath = connectionLine.getAttribute('d');
        
        if (!currentPath) {
            console.warn('saveConnectionLineAdjustment: 连接线没有路径数据', { recordId });
            return;
        }
        
        const currentPoints = this.parsePathData(currentPath);
        
        // 构建连接线调整数据
        const connectionLineData = {
            isCustom: true,
            pathPoints: currentPoints,
            lastModified: Date.now()
        };

        // 保存到记录数据中
        if (window.recordManager) {
            const record = window.recordManager.getRecord(recordId);
            if (record) {
                record.connectionLine = connectionLineData;
                record.updatedAt = new Date().toISOString();
                
                // 触发自动保存
                if (window.storageManager) {
                    window.storageManager.triggerAutoSave();
                }
                
            }
        }
    }

    /**
     * 解析SVG路径数据为点数组
     * @param {string} pathData - SVG路径数据
     * @returns {Array} 点数组 [{x, y}, ...]
     */
    parsePathData(pathData) {
        const points = [];
        
        // 检查pathData是否有效
        if (!pathData || typeof pathData !== 'string') {
            console.warn('parsePathData: 无效的路径数据', { pathData });
            return points;
        }
        
        const commands = pathData.match(/[ML]\s*[\d.-]+\s*[\d.-]+/g);
        
        if (!commands || commands.length === 0) {
            console.warn('parsePathData: 未找到有效的路径命令', { pathData });
            return points;
        }
        
        commands.forEach(command => {
            const coords = command.match(/[\d.-]+/g);
            if (coords && coords.length >= 2) {
                points.push({
                    x: parseFloat(coords[0]),
                    y: parseFloat(coords[1])
                });
            }
        });
        
        return points;
    }

    /**
     * 从点数组生成SVG路径
     * @param {Array} points - 点数组
     * @returns {string} SVG路径字符串
     */
    generatePathFromPoints(points) {
        if (points.length < 2) return '';
        
        let path = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }
        
        return path;
    }

    /**
     * 重置连接线到默认状态
     * @param {string} recordId - 记录ID
     */
    resetConnectionLine(recordId) {
        if (window.recordManager) {
            const record = window.recordManager.getRecord(recordId);
            if (record && record.connectionLine) {
                // 删除自定义连接线数据
                delete record.connectionLine;
                record.updatedAt = new Date().toISOString();
                
                // 触发自动保存
                if (window.storageManager) {
                    window.storageManager.triggerAutoSave();
                }
                
                // 重新绘制连接线
                window.recordManager.drawConnectionLine(record);
                
                // 如果当前选中该记录，重新显示控制手柄
                if (this.selectedRecordId === recordId) {
                    this.showControlHandles(recordId);
                }
                
            }
        }
    }

    /**
     * 获取当前选中的记录ID
     * @returns {string|null} 记录ID
     */
    getSelectedRecordId() {
        return this.selectedRecordId;
    }
}

// 导出到全局
window.ConnectionLineAdjuster = ConnectionLineAdjuster;