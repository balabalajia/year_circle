/**
 * 交互处理器
 * 负责拖拽、缩放、模态框等用户交互
 */

class InteractionHandler {
    constructor(recordManager, circleRenderer) {
        this.recordManager = recordManager;
        this.circleRenderer = circleRenderer;
        
        // 拖拽相关
        this.isDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // 缩放相关
        this.isResizing = false;
        this.resizeTarget = null;
        this.resizeStartSize = { width: 0, height: 0 };
        this.resizeStartPos = { x: 0, y: 0 };
        
        // 模态框相关
        this.currentModal = null;
        this.selectedDate = null;
        
        // 边界检测
        this.canvasBounds = null;
        this.snapThreshold = 10; // 吸附阈值
        
        this.init();
    }

    /**
     * 初始化交互处理器
     */
    init() {
        this.setupDragAndDrop();
        this.setupModalHandlers();
        this.setupKeyboardShortcuts();
        this.setupCanvasInteraction();
        this.setupContextMenu(); // V1.2新增：右键菜单
        this.updateCanvasBounds();
        
        // 监听窗口大小变化
        window.addEventListener('resize', debounce(() => {
            this.updateCanvasBounds();
        }, 250));
    }

    /**
     * 设置拖拽功能
     */
    setupDragAndDrop() {
        const canvas = document.getElementById('year-circle-canvas');
        
        // 鼠标按下事件
        canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });
        
        // 鼠标移动事件
        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        // 鼠标释放事件
        document.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
        
        // 防止默认拖拽行为
        canvas.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
    }

    /**
     * 处理鼠标按下事件
     * @param {MouseEvent} e - 鼠标事件
     */
    handleMouseDown(e) {
        const target = e.target.closest('.record-card');
        const resizeHandle = e.target.closest('.resize-handle');
        
        if (resizeHandle) {
            // 开始缩放
            this.startResize(e, resizeHandle);
        } else if (target) {
            // 开始拖拽
            this.startDrag(e, target);
        } else {
            // 点击空白区域，取消选中
            this.recordManager.selectedRecord = null;
            document.querySelectorAll('.record-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
        }
    }

    /**
     * 开始拖拽
     * @param {MouseEvent} e - 鼠标事件
     * @param {HTMLElement} target - 目标元素
     */
    startDrag(e, target) {
        this.isDragging = true;
        this.dragTarget = target;
        
        const rect = target.getBoundingClientRect();
        const canvasRect = document.getElementById('year-circle-canvas').getBoundingClientRect();
        
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // 添加拖拽样式
        target.classList.add('dragging');
        document.body.style.cursor = 'grabbing';
        
        // 选中记录
        const recordId = target.dataset.recordId;
        this.recordManager.selectRecord(recordId);
        
        e.preventDefault();
    }

    /**
     * 开始缩放 - V1.2更新：支持多方向调节
     * @param {MouseEvent} e - 鼠标事件
     * @param {HTMLElement} handle - 缩放手柄
     */
    startResize(e, handle) {
        this.isResizing = true;
        this.resizeTarget = handle.closest('.record-card');
        this.resizeDirection = handle.dataset.direction; // 获取调节方向
        
        const rect = this.resizeTarget.getBoundingClientRect();
        this.resizeStartSize = {
            width: rect.width,
            height: rect.height
        };
        this.resizeStartPos = {
            x: e.clientX,
            y: e.clientY
        };
        
        // 添加缩放样式
        this.resizeTarget.classList.add('resizing');
        
        // 根据方向设置光标
        const cursorMap = {
            'se': 'se-resize',
            'e': 'e-resize',
            's': 's-resize'
        };
        document.body.style.cursor = cursorMap[this.resizeDirection] || 'se-resize';
        
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 处理鼠标移动事件
     * @param {MouseEvent} e - 鼠标事件
     */
    handleMouseMove(e) {
        if (this.isDragging && this.dragTarget) {
            this.handleDrag(e);
        } else if (this.isResizing && this.resizeTarget) {
            this.handleResize(e);
        }
    }

    /**
     * 处理拖拽移动
     * @param {MouseEvent} e - 鼠标事件
     */
    handleDrag(e) {
        const canvasRect = document.getElementById('year-circle-canvas').getBoundingClientRect();
        
        let newX = e.clientX - canvasRect.left - this.dragOffset.x;
        let newY = e.clientY - canvasRect.top - this.dragOffset.y;
        
        // 边界检测和约束
        const targetRect = this.dragTarget.getBoundingClientRect();
        const bounds = this.getConstrainedPosition(newX, newY, targetRect.width, targetRect.height);
        
        // 吸附检测
        const snappedBounds = this.applySnapping(bounds);
        
        // 应用位置
        this.dragTarget.style.left = `${snappedBounds.x}px`;
        this.dragTarget.style.top = `${snappedBounds.y}px`;
        
        // 实时更新连接线（拖拽过程中使用防抖机制）
        const recordId = this.dragTarget.dataset.recordId;
        this.recordManager.updateRecordPosition(recordId, {
            x: snappedBounds.x,
            y: snappedBounds.y
        }, true); // 传递isDragging=true
    }

    /**
     * 处理缩放移动 - V1.2更新：支持多方向调节
     * @param {MouseEvent} e - 鼠标事件
     */
    handleResize(e) {
        const deltaX = e.clientX - this.resizeStartPos.x;
        const deltaY = e.clientY - this.resizeStartPos.y;
        
        // 计算新尺寸（保持最小尺寸）
        const minWidth = 80;
        const minHeight = 60;
        const maxWidth = 500;
        const maxHeight = 400;
        
        let newWidth = this.resizeStartSize.width;
        let newHeight = this.resizeStartSize.height;
        
        // 根据调节方向计算新尺寸
        switch (this.resizeDirection) {
            case 'se': // 同时调节宽高
                newWidth = Math.max(minWidth, Math.min(maxWidth, this.resizeStartSize.width + deltaX));
                newHeight = Math.max(minHeight, Math.min(maxHeight, this.resizeStartSize.height + deltaY));
                break;
            case 'e': // 仅调节宽度
                newWidth = Math.max(minWidth, Math.min(maxWidth, this.resizeStartSize.width + deltaX));
                break;
            case 's': // 仅调节高度
                newHeight = Math.max(minHeight, Math.min(maxHeight, this.resizeStartSize.height + deltaY));
                break;
        }
        
        const recordId = this.resizeTarget.dataset.recordId;
        
        // 应用新尺寸
        this.resizeTarget.style.width = `${newWidth}px`;
        this.resizeTarget.style.height = `${newHeight}px`;
        
        // 更新记录数据（但不立即重绘连接线，避免频繁重绘）
        const record = this.recordManager.getRecord(recordId);
        if (record) {
            const oldSize = { ...record.size };
            // 直接更新记录的尺寸数据，不触发连接线重绘
            record.size = { width: newWidth, height: newHeight };
            record.updatedAt = new Date().toISOString();
            
            
            // 更新尺寸类
            this.recordManager.updateSizeClass(recordId);
        } else {
            console.warn(`[InteractionHandler] 未找到记录: ${recordId}`);
        }
    }

    /**
     * 处理鼠标释放事件
     * @param {MouseEvent} e - 鼠标事件
     */
    handleMouseUp(e) {
        if (this.isDragging) {
            this.endDrag();
        } else if (this.isResizing) {
            this.endResize();
        }
    }

    /**
     * 结束拖拽
     */
    endDrag() {
        if (this.dragTarget) {
            // 拖拽结束时立即更新连接线到最终位置
            const recordId = this.dragTarget.dataset.recordId;
            const finalRect = this.dragTarget.getBoundingClientRect();
            const canvasRect = document.getElementById('year-circle-canvas').getBoundingClientRect();
            
            const finalPosition = {
                x: finalRect.left - canvasRect.left,
                y: finalRect.top - canvasRect.top
            };
            
            // 立即更新连接线到最终位置（isDragging=false）
            this.recordManager.updateRecordPosition(recordId, finalPosition, false);
            
            this.dragTarget.classList.remove('dragging');
            this.dragTarget = null;
        }
        
        this.isDragging = false;
        document.body.style.cursor = '';
        
        // 触发自动保存
        if (window.storageManager) {
            window.storageManager.triggerAutoSave();
        }
    }

    /**
     * 结束缩放
     */
    endResize() {
        
        if (this.resizeTarget) {
            // 获取记录ID
            const recordId = this.resizeTarget.dataset.recordId;
            const record = this.recordManager.getRecord(recordId);
            
            
            if (record) {
                const finalSize = record.size;
                
                // 获取调整大小后的最终位置（类似endDrag的逻辑）
                const finalRect = this.resizeTarget.getBoundingClientRect();
                const canvasRect = document.getElementById('year-circle-canvas').getBoundingClientRect();
                
                const finalPosition = {
                    x: finalRect.left - canvasRect.left,
                    y: finalRect.top - canvasRect.top
                };
                
                
                // 移除缩放状态
                this.resizeTarget.classList.remove('resizing');
                this.resizeTarget = null;
                this.isResizing = false;
                document.body.style.cursor = '';
                
                // 更新记录位置数据，然后立即重绘连接线（类似endDrag的逻辑）
                this.recordManager.updateRecordPosition(recordId, finalPosition, false);
                
            } else {
                console.warn(`[InteractionHandler] 未找到记录，无法重绘连接线: ${recordId}`);
                // 清理状态
                this.resizeTarget.classList.remove('resizing');
                this.resizeTarget = null;
                this.isResizing = false;
                document.body.style.cursor = '';
            }
        } else {
            // 清理状态
            this.isResizing = false;
            document.body.style.cursor = '';
        }
        
        
        // 触发自动保存
        if (window.storageManager) {
            window.storageManager.triggerAutoSave();
        }
    }

    /**
     * 调度连接线重绘，使用多重延迟确保DOM完全更新
     * @param {string} recordId - 记录ID
     * @param {Object} record - 记录对象
     */
    scheduleConnectionLineRedraw(recordId, record) {
        // 第一次延迟：等待DOM布局更新
        requestAnimationFrame(() => {
            
            // 第二次延迟：确保所有样式和布局计算完成
            setTimeout(() => {
                
                // 获取最新的DOM元素信息
                const cardElement = document.querySelector(`[data-record-id="${recordId}"]`);
                if (cardElement) {
                    const rect = cardElement.getBoundingClientRect();
                    
                    // 获取当前实际位置，传递给连接线绘制函数
                    const canvasContainer = document.getElementById('year-circle-canvas');
                    if (canvasContainer) {
                        const canvasRect = canvasContainer.getBoundingClientRect();
                        const actualPosition = {
                            x: rect.left - canvasRect.left,
                            y: rect.top - canvasRect.top
                        };
                        
                        // 执行连接线重绘，传递当前实际位置
                        this.recordManager.drawConnectionLine(record, true, actualPosition);
                    } else {
                        console.warn(`[InteractionHandler] 未找到画布容器，使用记录数据重绘`);
                        this.recordManager.drawConnectionLine(record, true, record.position);
                    }
                } else {
                    console.warn(`[InteractionHandler] 延迟重绘时未找到DOM元素: ${recordId}`);
                    // 仍然尝试重绘，使用记录中的数据
                    this.recordManager.drawConnectionLine(record, true, record.position);
                }
            }, 50); // 50ms延迟确保DOM完全更新
        });
    }

    /**
     * 获取约束后的位置
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {Object} 约束后的位置
     */
    getConstrainedPosition(x, y, width, height) {
        if (!this.canvasBounds) return { x, y };
        
        const margin = 10;
        
        // 确保记录卡片不超出画布边界
        const constrainedX = Math.max(margin, 
            Math.min(x, this.canvasBounds.width - width - margin));
        const constrainedY = Math.max(margin, 
            Math.min(y, this.canvasBounds.height - height - margin));
        
        return { x: constrainedX, y: constrainedY };
    }

    /**
     * 应用吸附效果
     * @param {Object} position - 位置 {x, y}
     * @returns {Object} 吸附后的位置
     */
    applySnapping(position) {
        if (!this.canvasBounds) return position;
        
        let { x, y } = position;
        
        // 边缘吸附
        if (Math.abs(x) < this.snapThreshold) {
            x = 0;
        }
        if (Math.abs(y) < this.snapThreshold) {
            y = 0;
        }
        if (Math.abs(x - (this.canvasBounds.width - this.dragTarget.offsetWidth)) < this.snapThreshold) {
            x = this.canvasBounds.width - this.dragTarget.offsetWidth;
        }
        if (Math.abs(y - (this.canvasBounds.height - this.dragTarget.offsetHeight)) < this.snapThreshold) {
            y = this.canvasBounds.height - this.dragTarget.offsetHeight;
        }
        
        // 网格吸附（可选）
        const gridSize = 20;
        const snapToGrid = false; // 可以通过设置启用
        
        if (snapToGrid) {
            x = Math.round(x / gridSize) * gridSize;
            y = Math.round(y / gridSize) * gridSize;
        }
        
        return { x, y };
    }

    /**
     * 设置模态框处理器
     */
    setupModalHandlers() {
        const modal = document.getElementById('record-modal');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const saveBtn = modal.querySelector('.save-btn');
        
        // 关闭按钮
        closeBtn.addEventListener('click', () => {
            this.closeModal();
        });
        
        // 取消按钮
        cancelBtn.addEventListener('click', () => {
            this.closeModal();
        });
        
        // 保存按钮
        saveBtn.addEventListener('click', () => {
            this.saveRecord();
        });
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // 文字输入实时验证和字符计数
        const textArea = modal.querySelector('#record-text');
        if (textArea) {
            // 添加字符计数显示
            this.addCharacterCounter(textArea);
            
            // 实时验证
            textArea.addEventListener('input', () => {
                this.validateTextInput(textArea);
                this.updateSaveButtonState();
            });
            
            // 支持Ctrl+Enter快速保存
            textArea.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    this.saveRecord();
                }
            });
        }
        
        // 边框颜色选择器事件处理
        this.setupBorderColorSelector();
        
        // 文件上传处理
        const fileInput = document.getElementById('image-upload');
        const dropZone = document.querySelector('.image-upload-area');
        
        if (!fileInput) {
            return;
        }
        
        if (!dropZone) {
            return;
        }
        
        // 点击上传区域触发文件选择
        dropZone.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFileUpload(e.target.files[0]);
            }
        });
        
        // 拖拽上传
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFileUpload(file);
            } else {
                this.showMessage('请拖拽有效的图片文件', 'error');
            }
        });
        
        // 记录类型切换
        const typeRadios = modal.querySelectorAll('input[name="record-type"]');
        typeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleRecordType(e.target.value);
                this.updateSaveButtonState();
            });
        });
        
        // 图片描述输入验证
        const imageDescription = modal.querySelector('#image-description');
        if (imageDescription) {
            this.addCharacterCounter(imageDescription, 200); // 图片描述限制200字符
            
            imageDescription.addEventListener('input', () => {
                this.validateImageDescription(imageDescription);
                this.updateSaveButtonState(); // 更新保存按钮状态
            });
        }
    }

    /**
     * 设置边框颜色选择器事件处理
     */
    setupBorderColorSelector() {
        const borderColorOptions = document.querySelectorAll('.border-color-option');
        
        borderColorOptions.forEach(option => {
            // 为整个选项区域添加点击事件
            option.addEventListener('click', (e) => {
                // 防止事件冒泡
                e.stopPropagation();
                
                // 获取对应的radio按钮
                const radioInput = option.querySelector('input[type="radio"]');
                if (radioInput) {
                    // 选中radio按钮
                    radioInput.checked = true;
                    
                    // 触发change事件，确保其他逻辑能够响应
                    radioInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            
            // 为radio按钮添加change事件处理
            const radioInput = option.querySelector('input[type="radio"]');
            if (radioInput) {
                radioInput.addEventListener('change', () => {
                    // 更新保存按钮状态（如果需要的话）
                    this.updateSaveButtonState();
                });
            }
        });
    }

    /**
     * 添加字符计数器
     * @param {HTMLElement} textElement - 文本输入元素
     * @param {number} maxLength - 最大长度限制（可选）
     */
    addCharacterCounter(textElement, maxLength = 500) {
        // 设置最大长度
        textElement.setAttribute('maxlength', maxLength);
        
        // 创建计数器元素
        const counter = document.createElement('div');
        counter.className = 'character-counter';
        counter.style.cssText = `
            font-size: 12px;
            color: #666;
            text-align: right;
            margin-top: 4px;
        `;
        
        // 插入计数器
        textElement.parentNode.insertBefore(counter, textElement.nextSibling);
        
        // 更新计数器
        const updateCounter = () => {
            const current = textElement.value.length;
            counter.textContent = `${current}/${maxLength}`;
            
            // 根据字符数量改变颜色
            if (current > maxLength * 0.9) {
                counter.style.color = '#e74c3c';
            } else if (current > maxLength * 0.7) {
                counter.style.color = '#f39c12';
            } else {
                counter.style.color = '#666';
            }
        };
        
        // 初始化和监听变化
        updateCounter();
        textElement.addEventListener('input', updateCounter);
    }

    /**
     * 验证文字输入
     * @param {HTMLElement} textArea - 文本区域元素
     */
    validateTextInput(textArea) {
        const content = textArea.value.trim();
        const container = textArea.closest('.text-input-section');
        
        // 移除之前的错误提示
        const existingError = container.querySelector('.validation-error');
        if (existingError) {
            existingError.remove();
        }
        
        // 验证内容
        if (content.length === 0) {
            textArea.classList.add('error');
            return false;
        } else if (content.length < 2) {
            this.showValidationError(container, '记录内容至少需要2个字符');
            textArea.classList.add('error');
            return false;
        } else {
            textArea.classList.remove('error');
            return true;
        }
    }

    /**
     * 验证图片描述
     * @param {HTMLElement} descriptionArea - 描述文本区域
     */
    validateImageDescription(descriptionArea) {
        const content = descriptionArea.value.trim();
        
        if (content.length > 200) {
            descriptionArea.classList.add('error');
            return false;
        } else {
            descriptionArea.classList.remove('error');
            return true;
        }
    }

    /**
     * 显示验证错误信息
     * @param {HTMLElement} container - 容器元素
     * @param {string} message - 错误信息
     */
    showValidationError(container, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.style.cssText = `
            color: #e74c3c;
            font-size: 12px;
            margin-top: 4px;
        `;
        errorDiv.textContent = message;
        container.appendChild(errorDiv);
    }

    /**
     * 更新保存按钮状态
     */
    updateSaveButtonState() {
        const modal = this.currentModal;
        if (!modal) return;
        
        const saveBtn = modal.querySelector('.save-btn');
        const recordType = modal.querySelector('input[name="record-type"]:checked').value;
        
        let isValid = false;
        
        if (recordType === 'text') {
            const textArea = modal.querySelector('#record-text');
            isValid = this.validateTextInput(textArea);
        } else if (recordType === 'image') {
            const imageData = modal.querySelector('.image-preview').dataset.imageData;
            const description = modal.querySelector('#image-description').value.trim();
            
            // 图片记录需要有图片数据，描述是可选的但不能超过200字符
            isValid = !!imageData && description.length <= 200;
        }
        
        saveBtn.disabled = !isValid;
        saveBtn.classList.toggle('disabled', !isValid);
    }

    /**
     * 显示消息提示
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, error, info)
     */
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-toast ${type}`;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        // 设置背景色
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db'
        };
        messageDiv.style.backgroundColor = colors[type] || colors.info;
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageDiv.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 打开模态框 - 优化版本，支持编辑模式标识
     * @param {string} date - 选中的日期
     * @param {Object} record - 编辑的记录（可选）
     */
    openModal(date, record = null) {
        this.selectedDate = date;
        this.currentModal = document.getElementById('record-modal');
        
        // 重置表单
        this.resetModalForm();
        
        // 设置编辑模式标识
        if (record) {
            this.currentModal.dataset.editRecordId = record.id;
        } else {
            delete this.currentModal.dataset.editRecordId;
        }
        
        // 显示选中的日期
        const dateElement = this.currentModal.querySelector('#selected-date');
        if (dateElement) {
            const formattedDate = DateUtils.formatDateString(date);
            dateElement.textContent = `选择的日期：${formattedDate}`;
        }
        
        // 更新模态框标题
        const titleElement = this.currentModal.querySelector('#modal-title');
        if (titleElement) {
            titleElement.textContent = record ? '编辑记录' : '添加记录';
        }
        
        // 如果是编辑模式，填充数据
        if (record) {
            this.fillModalForm(record);
        }
        
        // 显示模态框
        this.currentModal.classList.add('active');
        document.body.classList.add('modal-open');
        
        // 聚焦到第一个输入框
        const firstInput = this.currentModal.querySelector('input[type="text"], textarea');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
                // 如果是文本框，将光标移到末尾
                if (firstInput.tagName === 'TEXTAREA') {
                    firstInput.setSelectionRange(firstInput.value.length, firstInput.value.length);
                }
            }, 100);
        }
        
        // 初始化保存按钮状态
        setTimeout(() => {
            this.updateSaveButtonState();
        }, 50);
    }

    /**
     * 重置模态框表单 - 优化版本
     */
    resetModalForm() {
        const modal = this.currentModal;
        if (!modal) return;
        
        // 重置文本输入
        const textArea = modal.querySelector('#record-text');
        if (textArea) {
            textArea.value = '';
            textArea.classList.remove('error');
        }
        
        const imageDescription = modal.querySelector('#image-description');
        if (imageDescription) {
            imageDescription.value = '';
            imageDescription.classList.remove('error');
        }
        
        // 重置文件上传
        const imageUpload = modal.querySelector('#image-upload');
        if (imageUpload) {
            imageUpload.value = '';
        }
        this.removeImagePreview();
        
        // 重置记录类型
        const textRadio = modal.querySelector('input[value="text"]');
        if (textRadio) {
            textRadio.checked = true;
            this.toggleRecordType('text');
        }
        
        // 移除所有验证错误信息
        modal.querySelectorAll('.validation-error').forEach(error => error.remove());
        
        // 重置保存按钮状态
        const saveBtn = modal.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
        }
        
        // 清除编辑模式标识
        delete modal.dataset.editRecordId;
    }

    /**
     * 填充模态框表单（编辑模式）
     * @param {Object} record - 记录对象
     */
    fillModalForm(record) {
        const modal = this.currentModal;
        
        // 设置记录类型
        modal.querySelector(`input[value="${record.type}"]`).checked = true;
        this.toggleRecordType(record.type);
        
        // 设置边框颜色（如果记录中有边框颜色，否则使用默认值）
        const borderColor = record.borderColor || 'classic';
        const borderColorInput = modal.querySelector(`input[name="border-color"][value="${borderColor}"]`);
        if (borderColorInput) {
            borderColorInput.checked = true;
        }
        
        if (record.type === 'text') {
            modal.querySelector('#record-text').value = record.content;
        } else if (record.type === 'image') {
            modal.querySelector('#image-description').value = record.content.description || '';
            
            // 显示图片预览并设置必要的数据属性
            const preview = modal.querySelector('.image-preview');
            preview.innerHTML = `
                <div class="image-preview-container">
                    <img src="${record.content.imageData}" alt="预览" class="preview-image">
                    <div class="image-info">
                        <span class="file-name">已上传的图片</span>
                        <button type="button" class="remove-image-btn" title="移除图片">×</button>
                    </div>
                </div>
            `;
            preview.style.display = 'block';
            
            // 关键修复：设置imageData属性，确保编辑时能正确保存
            preview.dataset.imageData = record.content.imageData;
            
            // 添加移除图片功能
            const removeBtn = preview.querySelector('.remove-image-btn');
            removeBtn.addEventListener('click', () => {
                this.removeImagePreview();
            });
        }
    }

    /**
     * 切换记录类型
     * @param {string} type - 记录类型
     */
    toggleRecordType(type) {
        const modal = this.currentModal;
        const textSection = modal.querySelector('.text-input-section');
        const imageSection = modal.querySelector('.image-input-section');
        
        if (type === 'text') {
            textSection.style.display = 'block';
            imageSection.style.display = 'none';
        } else {
            textSection.style.display = 'none';
            imageSection.style.display = 'block';
        }
    }

    /**
     * 处理文件上传 - 优化版本，支持图片压缩和更好的验证
     * @param {File} file - 上传的文件
     */
    handleFileUpload(file) {
        if (!file) {
            this.showMessage('请选择文件', 'error');
            return;
        }
        
        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            this.showMessage('请选择有效的图片文件 (JPG, PNG, GIF, WebP)', 'error');
            return;
        }
        
        // 文件大小检查（10MB限制）
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showMessage('图片文件大小不能超过10MB', 'error');
            return;
        }
        
        // 显示加载状态
        this.showImageUploadLoading(true);
        
        // 创建图片对象进行预处理
        const img = new Image();
        img.onload = () => {
            try {
                // 压缩图片
                const compressedDataUrl = this.compressImage(img, file.type);
                
                // 显示预览
                this.showImagePreview(compressedDataUrl, file.name);
                
                // 存储图片数据
                const preview = this.currentModal.querySelector('.image-preview');
                preview.dataset.imageData = compressedDataUrl;
                
                // 更新保存按钮状态
                this.updateSaveButtonState();
                
                this.showMessage('图片上传成功', 'success');
            } catch (error) {
                this.showMessage('图片处理失败，请重试', 'error');
            } finally {
                this.showImageUploadLoading(false);
            }
        };
        
        img.onerror = () => {
            this.showImageUploadLoading(false);
            this.showMessage('图片加载失败，请检查文件是否损坏', 'error');
        };
        
        // 读取文件
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.onerror = () => {
            this.showImageUploadLoading(false);
            this.showMessage('文件读取失败', 'error');
        };
        
        reader.readAsDataURL(file);
    }

    /**
     * 压缩图片
     * @param {HTMLImageElement} img - 图片元素
     * @param {string} mimeType - 图片MIME类型
     * @returns {string} 压缩后的DataURL
     */
    compressImage(img, mimeType) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 计算压缩后的尺寸
        const maxWidth = 1200;
        const maxHeight = 1200;
        let { width, height } = img;
        
        // 按比例缩放
        if (width > height) {
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
        }
        
        // 设置画布尺寸
        canvas.width = width;
        canvas.height = height;
        
        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);
        
        // 根据文件类型设置压缩质量
        let quality = 0.8;
        if (mimeType === 'image/png') {
            // PNG保持原格式，不压缩质量
            return canvas.toDataURL(mimeType);
        } else {
            // JPEG等格式进行质量压缩
            return canvas.toDataURL('image/jpeg', quality);
        }
    }

    /**
     * 显示图片预览
     * @param {string} dataUrl - 图片数据URL
     * @param {string} fileName - 文件名
     */
    showImagePreview(dataUrl, fileName) {
        const preview = this.currentModal.querySelector('.image-preview');
        
        preview.innerHTML = `
            <div class="image-preview-container">
                <img src="${dataUrl}" alt="预览" class="preview-image">
                <div class="image-info">
                    <span class="file-name">${fileName}</span>
                    <button type="button" class="remove-image-btn" title="移除图片">×</button>
                </div>
            </div>
        `;
        
        preview.style.display = 'block';
        
        // 添加移除图片功能
        const removeBtn = preview.querySelector('.remove-image-btn');
        removeBtn.addEventListener('click', () => {
            this.removeImagePreview();
        });
    }

    /**
     * 移除图片预览
     */
    removeImagePreview() {
        if (!this.currentModal) return;
        
        const preview = this.currentModal.querySelector('.image-preview');
        if (preview) {
            preview.innerHTML = '';
            preview.style.display = 'none';
            delete preview.dataset.imageData;
        }
        
        // 重置文件输入
        const fileInput = this.currentModal.querySelector('#image-upload');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // 更新保存按钮状态
        this.updateSaveButtonState();
    }

    /**
     * 显示图片上传加载状态
     * @param {boolean} show - 是否显示加载状态
     */
    showImageUploadLoading(show) {
        const dropZone = this.currentModal.querySelector('.image-upload-area');
        
        if (show) {
            dropZone.classList.add('loading');
            dropZone.innerHTML = `
                <div class="upload-loading">
                    <div class="loading-spinner"></div>
                    <p>正在处理图片...</p>
                </div>
            `;
        } else {
            dropZone.classList.remove('loading');
            dropZone.innerHTML = '<p>点击选择图片或拖拽图片到此处</p>';
        }
    }

    /**
     * 保存记录 - 优化版本，支持创建和编辑模式
     */
    saveRecord() {
        const modal = this.currentModal;
        const recordType = modal.querySelector('input[name="record-type"]:checked').value;
        
        let content;
        let isValid = false;
        let validationMessage = '';
        
        // 验证记录内容
        if (recordType === 'text') {
            const textArea = modal.querySelector('#record-text');
            content = textArea.value.trim();
            
            if (content.length === 0) {
                validationMessage = '请输入记录内容';
            } else if (content.length < 2) {
                validationMessage = '记录内容至少需要2个字符';
            } else if (content.length > 500) {
                validationMessage = '记录内容不能超过500个字符';
            } else {
                isValid = true;
            }
        } else if (recordType === 'image') {
            const imageData = modal.querySelector('.image-preview').dataset.imageData;
            const description = modal.querySelector('#image-description').value.trim();
            
            if (!imageData) {
                validationMessage = '请选择图片文件';
            } else if (description.length > 200) {
                validationMessage = '图片描述不能超过200个字符';
            } else {
                content = { imageData, description };
                isValid = true;
            }
        }
        
        // 验证失败时显示错误信息
        if (!isValid) {
            this.showMessage(validationMessage, 'error');
            return;
        }
        
        try {
            // 检查是否为编辑模式
            const isEditMode = modal.dataset.editRecordId;
            
            if (isEditMode) {
                // 编辑现有记录
                this.updateExistingRecord(isEditMode, recordType, content);
            } else {
                // 创建新记录
                this.createNewRecord(recordType, content);
            }
            
            // 关闭模态框
            this.closeModal();
            
            // 触发自动保存
            if (window.storageManager) {
                window.storageManager.triggerAutoSave();
            }
            
            // 显示成功消息
            const action = isEditMode ? '更新' : '创建';
            this.showMessage(`记录${action}成功`, 'success');
            
        } catch (error) {
            console.error('保存记录失败:', error);
            this.showMessage('保存记录失败，请重试', 'error');
        }
    }

    /**
     * 创建新记录
     * @param {string} recordType - 记录类型
     * @param {string|Object} content - 记录内容
     */
    createNewRecord(recordType, content) {
        // 获取选择的边框颜色
        const modal = this.currentModal;
        const borderColor = modal.querySelector('input[name="border-color"]:checked').value;
        
        const recordData = {
            date: this.selectedDate,
            type: recordType,
            content: content,
            borderColor: borderColor // 添加边框颜色字段
        };
        
        const recordId = this.recordManager.createRecord(recordData);
        
        // 清除选中状态，避免位置偏移
        if (this.circleRenderer) {
            const dateInfo = DateUtils.parseDate(this.selectedDate);
            if (dateInfo) {
                const dateDot = this.circleRenderer.dateDots.get(`${dateInfo.month}-${dateInfo.day}`);
                if (dateDot) {
                    dateDot.classList.remove('selected');
                }
            }
        }
    }

    /**
     * 更新现有记录
     * @param {string} recordId - 记录ID
     * @param {string} recordType - 记录类型
     * @param {string|Object} content - 记录内容
     */
    updateExistingRecord(recordId, recordType, content) {
        const record = this.recordManager.getRecord(recordId);
        if (!record) {
            throw new Error(`记录不存在: ${recordId}`);
        }
        
        // 获取选择的边框颜色
        const modal = this.currentModal;
        const borderColor = modal.querySelector('input[name="border-color"]:checked').value;
        
        // 更新记录数据
        record.type = recordType;
        record.content = content;
        record.borderColor = borderColor; // 添加边框颜色字段
        record.updatedAt = new Date().toISOString();
        
        // 重新渲染记录
        this.recordManager.removeRecordElement(recordId);
        this.recordManager.renderRecord(record);
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        if (this.currentModal) {
            this.currentModal.classList.remove('active');
            document.body.classList.remove('modal-open');
            this.currentModal = null;
            this.selectedDate = null;
        }
    }



    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC键关闭模态框
            if (e.key === 'Escape' && this.currentModal) {
                this.closeModal();
            }
            
            // Ctrl+S 保存
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (window.storageManager) {
                    window.storageManager.saveData();
                }
            }
            
            // Delete键删除选中记录
            if (e.key === 'Delete' && this.recordManager.selectedRecord) {
                this.recordManager.deleteRecord(this.recordManager.selectedRecord);
            }
        });
    }

    /**
     * 设置画布交互
     */
    setupCanvasInteraction() {
        // 监听日期选择事件（新的事件名称）
        document.addEventListener('dateSelected', (e) => {
            const { year, month, day } = e.detail;
            
            // 参数验证，防止undefined导致错误
            if (year === undefined || month === undefined || day === undefined) {
                return;
            }
            
            const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            this.openModal(date);
        });
        
        // 监听记录编辑事件
        document.addEventListener('recordEdit', (e) => {
            const record = e.detail.record;
            this.openModal(record.date, record);
        });
        
        // 监听记录删除事件
        document.addEventListener('recordDeleted', (e) => {
            const { month, day } = e.detail;
            this.circleRenderer.unmarkDateAsRecorded(month, day);
        });
        
        // 监听记录创建事件
        document.addEventListener('recordCreated', (e) => {
            const { month, day } = e.detail;
            this.circleRenderer.markDateAsRecorded(month, day);
        });
    }

    /**
     * 更新画布边界
     */
    updateCanvasBounds() {
        const canvas = document.getElementById('year-circle-canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            this.canvasBounds = {
                width: rect.width,
                height: rect.height
            };
        }
    }

    /**
     * 获取鼠标相对于画布的位置
     * @param {MouseEvent} e - 鼠标事件
     * @returns {Object} 相对位置 {x, y}
     */
    getCanvasRelativePosition(e) {
        const canvas = document.getElementById('year-circle-canvas');
        const rect = canvas.getBoundingClientRect();
        
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * 检查点是否在圆形区域内
     * @param {Object} point - 点坐标 {x, y}
     * @param {Object} center - 圆心坐标 {x, y}
     * @param {number} radius - 半径
     * @returns {boolean} 是否在圆内
     */
    isPointInCircle(point, center, radius) {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    }

    /**
     * 设置右键上下文菜单 - V1.2新增
     */
    setupContextMenu() {
        this.contextMenu = document.getElementById('context-menu');
        this.currentContextTarget = null;
        
        // 监听记录卡片的右键事件
        document.addEventListener('contextmenu', (e) => {
            const recordCard = e.target.closest('.record-card');
            if (recordCard) {
                e.preventDefault();
                this.showContextMenu(e, recordCard);
            } else {
                this.hideContextMenu();
            }
        });
        
        // 监听菜单项点击
        this.contextMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.context-menu-item');
            if (menuItem && this.currentContextTarget) {
                const action = menuItem.dataset.action;
                this.handleContextMenuAction(action, this.currentContextTarget);
                this.hideContextMenu();
            }
        });
        
        // 点击其他地方隐藏菜单
        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
        
        // ESC键隐藏菜单
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    }
    
    /**
     * 显示右键菜单
     * @param {MouseEvent} e - 鼠标事件
     * @param {HTMLElement} target - 目标记录卡片
     */
    showContextMenu(e, target) {
        this.currentContextTarget = target;
        this.contextMenu.style.display = 'block';
        
        // 计算菜单位置，确保不超出视窗
        const menuRect = this.contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let x = e.clientX;
        let y = e.clientY;
        
        // 防止菜单超出右边界
        if (x + menuRect.width > viewportWidth) {
            x = viewportWidth - menuRect.width - 5;
        }
        
        // 防止菜单超出下边界
        if (y + menuRect.height > viewportHeight) {
            y = viewportHeight - menuRect.height - 5;
        }
        
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
    }
    
    /**
     * 隐藏右键菜单
     */
    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.currentContextTarget = null;
    }
    
    /**
     * 处理右键菜单操作
     * @param {string} action - 操作类型
     * @param {HTMLElement} target - 目标记录卡片
     */
    handleContextMenuAction(action, target) {
        const recordId = target.dataset.recordId;
        const record = this.recordManager.getRecord(recordId);
        
        if (!record) return;
        
        switch (action) {
            case 'edit':
                // 打开编辑模态框
                this.openModal(record.date, record);
                break;
            case 'delete':
                // 确认删除
                if (confirm('确定要删除这条记录吗？')) {
                    this.recordManager.deleteRecord(recordId);
                }
                break;
        }
    }

    /**
     * 销毁交互处理器
     */
    destroy() {
        // 移除事件监听器
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
}

// 导出到全局
window.InteractionHandler = InteractionHandler;