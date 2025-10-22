/**
 * 环形图渲染器
 * 负责绘制环形月份图背景、月份标签和日期小点
 */

class CircleRenderer {
    constructor(svgElement) {
        this.svg = svgElement;
        this.centerX = 0;
        this.centerY = 0;
        this.radius = 0;
        this.monthRadius = 0;
        this.dateRadius = 0;
        this.currentYear = new Date().getFullYear();
        this.startDate = null; // 起始日期
        
        // 获取SVG组元素
        this.monthsGroup = this.svg.querySelector('#months-group');
        this.datesGroup = this.svg.querySelector('#dates-group');
        this.connectionsGroup = this.svg.querySelector('#connections-group');
        
        // 月份数据
        this.monthNames = [
            '一月', '二月', '三月', '四月', '五月', '六月',
            '七月', '八月', '九月', '十月', '十一月', '十二月'
        ];
        
        // 存储日期小点的引用
        this.dateDots = new Map(); // key: 'month-day', value: SVG element
        this.monthElements = new Map(); // key: month, value: SVG element
        
        this.initializeCanvas();
    }

    /**
     * 初始化画布尺寸和中心点
     */
    initializeCanvas() {
        const container = this.svg.parentElement;
        const containerRect = container.getBoundingClientRect();
        
        // 设置SVG尺寸
        this.svg.setAttribute('width', containerRect.width);
        this.svg.setAttribute('height', containerRect.height);
        this.svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
        
        // 计算中心点和半径
        this.centerX = containerRect.width / 2;
        this.centerY = containerRect.height / 2;
        this.radius = Math.min(containerRect.width, containerRect.height) * 0.35;
        this.monthRadius = this.radius + 50; // 增加月份标签距离
        this.dateRadius = this.radius - 15; // 调整日期小点位置
        
    }

    /**
     * 设置起始日期
     * @param {string} dateString - 日期字符串 (YYYY-MM-DD格式)
     */
    setStartDate(dateString) {
        this.startDate = dateString;
    }

    /**
     * 获取起始日期
     * @returns {string|null} 起始日期字符串
     */
    getStartDate() {
        return this.startDate;
    }

    /**
     * 渲染完整的环形图
     * @param {number} year - 年份
     */
    renderCircle(year) {
        this.currentYear = year;
        this.clearCanvas();
        this.drawBackground();
        this.drawMonths();
        this.drawDates();
        
    }

    /**
     * 重新渲染（保持当前年份）
     */
    render() {
        this.renderCircle(this.currentYear);
    }

    /**
     * 清空画布
     */
    clearCanvas() {
        this.monthsGroup.innerHTML = '';
        this.datesGroup.innerHTML = '';
        this.connectionsGroup.innerHTML = '';
        this.dateDots.clear();
        this.monthElements.clear();
    }

    /**
     * 绘制背景圆环
     */
    drawBackground() {
        // 主圆环
        const mainCircle = DOMUtils.createSVGElement('circle', {
            cx: this.centerX,
            cy: this.centerY,
            r: this.radius,
            class: 'circle-background'
        });
        this.monthsGroup.appendChild(mainCircle);

        // 内圆环（装饰用）
        const innerCircle = DOMUtils.createSVGElement('circle', {
            cx: this.centerX,
            cy: this.centerY,
            r: this.radius - 30,
            class: 'circle-inner',
            fill: 'none',
            stroke: 'var(--border-color)',
            'stroke-width': '1',
            opacity: '0.3'
        });
        this.monthsGroup.appendChild(innerCircle);

        // 月份分隔线 - 更精确的角度计算
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30) - 90; // 从12点位置开始，每月30度
            const startPoint = MathUtils.getPointOnCircle(
                this.centerX, this.centerY, this.radius - 15, angle
            );
            const endPoint = MathUtils.getPointOnCircle(
                this.centerX, this.centerY, this.radius + 15, angle
            );

            const line = DOMUtils.createSVGElement('line', {
                x1: startPoint.x,
                y1: startPoint.y,
                x2: endPoint.x,
                y2: endPoint.y,
                stroke: 'var(--border-color)',
                'stroke-width': '1.5',
                opacity: '0.6',
                class: 'month-separator'
            });
            this.monthsGroup.appendChild(line);
        }

        // 添加年份标识在中心
        const yearText = DOMUtils.createSVGElement('text', {
            x: this.centerX,
            y: this.centerY,
            class: 'year-center-text',
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
        });
        yearText.textContent = this.getYearRangeText();
        this.monthsGroup.appendChild(yearText);

        // 绘制起始点指示器（如果设置了起始日期）
        this.drawStartPointIndicator();
    }

    /**
     * 绘制月份标签
     */
    drawMonths() {
        for (let month = 1; month <= 12; month++) {
            const angle = ((month - 1) * 30) - 90; // 从12点位置开始
            const position = MathUtils.getPointOnCircle(
                this.centerX, this.centerY, this.monthRadius, angle
            );

            const monthText = DOMUtils.createSVGElement('text', {
                x: position.x,
                y: position.y,
                class: 'month-text',
                'data-month': month,
                'text-anchor': 'middle',
                'dominant-baseline': 'central'
            });
            monthText.textContent = this.monthNames[month - 1];

            // 添加月份背景圆圈
            const monthBg = DOMUtils.createSVGElement('circle', {
                cx: position.x,
                cy: position.y,
                r: 25,
                class: 'month-background',
                fill: 'var(--background-color)',
                stroke: 'var(--border-color)',
                'stroke-width': '1',
                opacity: '0.8'
            });

            this.monthsGroup.appendChild(monthBg);
            this.monthsGroup.appendChild(monthText);
            this.monthElements.set(month, monthText);
        }
    }

    /**
     * 绘制日期小点 - 优化闰年处理和分布算法
     */
    drawDates() {
        // 计算总天数 - 需要考虑跨年情况下的实际天数
        const yearDays = this.calculateTotalDaysInCycle();
        let currentDayOfYear = 0;

        for (let month = 1; month <= 12; month++) {
            // 计算该月份的实际年份
            const actualYear = this.calculateActualYear(month, 1);
            // 使用实际年份来判断该月的天数（特别重要的是2月份的闰年判断）
            const daysInMonth = DateUtils.getDaysInMonth(actualYear, month);
            
            
            for (let day = 1; day <= daysInMonth; day++) {
                currentDayOfYear++;
                
                // 更精确的角度计算，确保均匀分布
                const angle = ((currentDayOfYear - 1) / yearDays) * 360 - 90; // 从12点位置开始
                
                const position = MathUtils.getPointOnCircle(
                    this.centerX, this.centerY, this.dateRadius, angle
                );

                // 检查是否为起始日期
                const isStartDate = this.isStartDate(month, day);
                
                // 计算基于起始日期的实际年份（已在上面计算过）
                const actualYear = this.calculateActualYear(month, day);
                
                // 统一所有日期小点的样式
                let dotRadius = 2.5;
                let dotClass = 'date-dot';
                
                // 如果是起始日期，使用特殊样式
                if (isStartDate) {
                    dotRadius = 4;
                    dotClass = 'date-dot start-date';
                }

                const dateDot = DOMUtils.createSVGElement('circle', {
                    cx: position.x,
                    cy: position.y,
                    r: dotRadius,
                    class: dotClass,
                    'data-year': actualYear,
                    'data-month': month,
                    'data-day': day,
                    'data-date': DateUtils.formatDate(actualYear, month, day),
                    'data-day-of-year': currentDayOfYear
                });

                // 如果是起始日期，添加外圈
                if (isStartDate) {
                    const outerRing = DOMUtils.createSVGElement('circle', {
                        cx: position.x,
                        cy: position.y,
                        r: dotRadius + 3,
                        class: 'start-date-ring',
                        fill: 'none',
                        stroke: '#ff4757',
                        'stroke-width': '2'
                    });
                    this.datesGroup.appendChild(outerRing);
                }

                // 添加点击事件
                dateDot.addEventListener('click', (e) => {
                    this.handleDateClick(e, this.currentYear, month, day);
                });

                // 添加悬停事件（优化防抖机制）
                let hoverTimer = null;
                
                dateDot.addEventListener('mouseenter', (e) => {
                    // 清除之前的定时器
                    if (hoverTimer) {
                        clearTimeout(hoverTimer);
                    }
                    // 立即显示tooltip，提高响应性
                    this.showDateTooltip(e, this.currentYear, month, day);
                });

                dateDot.addEventListener('mouseleave', () => {
                    // 清除显示定时器
                    if (hoverTimer) {
                        clearTimeout(hoverTimer);
                        hoverTimer = null;
                    }
                    this.hideTooltip();
                });

                this.datesGroup.appendChild(dateDot);
                this.dateDots.set(`${month}-${day}`, dateDot);
            }
        }
    }

    /**
     * 判断是否为起始日期
     * @param {number} month - 月份
     * @param {number} day - 日期
     * @returns {boolean} 是否为起始日期
     */
    isStartDate(month, day) {
        if (!this.startDate) return false;
        
        const startDate = new Date(this.startDate);
        const startMonth = startDate.getMonth() + 1; // 月份从0开始，需要+1
        const startDay = startDate.getDate();
        
        return month === startMonth && day === startDay;
    }

    /**
     * 根据起始日期计算指定月日的实际年份
     * @param {number} month - 月份 (1-12)
     * @param {number} day - 日期
     * @returns {number} 实际年份
     */
    calculateActualYear(month, day) {
        // 如果没有设置起始日期，返回当前年份
        if (!this.startDate) {
            return this.currentYear;
        }
        
        const startDate = new Date(this.startDate);
        const startMonth = startDate.getMonth() + 1; // 月份从0开始，需要+1
        const startDay = startDate.getDate();
        
        // 如果是起始日期当月或之后的月份，使用当前年份
        if (month > startMonth || (month === startMonth && day >= startDay)) {
            return this.currentYear;
        }
        
        // 如果是起始日期之前的月份，使用下一年
        return this.currentYear + 1;
    }

    /**
     * 计算自定义周期的总天数
     * 考虑跨年情况下每个月份所在的实际年份
     * @returns {number} 周期总天数
     */
    calculateTotalDaysInCycle() {
        // 如果没有设置起始日期，使用标准年份天数
        if (!this.startDate) {
            return DateUtils.getDaysInYear(this.currentYear);
        }
        
        let totalDays = 0;
        
        // 遍历12个月，根据每个月的实际年份计算天数
        for (let month = 1; month <= 12; month++) {
            const actualYear = this.calculateActualYear(month, 1);
            const daysInMonth = DateUtils.getDaysInMonth(actualYear, month);
            totalDays += daysInMonth;
        }
        
        return totalDays;
    }

    /**
     * 获取年份范围显示文本
     * 根据是否设置起始日期返回不同的年份显示格式
     * @returns {string} 年份显示文本
     */
    getYearRangeText() {
        if (!this.startDate) {
            // 没有设置起始日期，显示单一年份
            return this.currentYear.toString();
        }
        
        // 设置了起始日期，显示年份范围
        const nextYear = this.currentYear + 1;
        return `${this.currentYear}-${nextYear}`;
    }

    /**
     * 处理日期点击事件
     * @param {Event} event - 点击事件
     * @param {number} year - 年份（原始参数，保持兼容性）
     * @param {number} month - 月份
     * @param {number} day - 日期
     */
    handleDateClick(event, year, month, day) {
        event.stopPropagation();
        
        // 参数验证，防止undefined导致错误
        if (year === undefined || month === undefined || day === undefined) {
            return;
        }
        
        // 计算基于起始日期的实际年份
        const actualYear = this.calculateActualYear(month, day);
        
        // 更新选中状态
        this.updateSelectedDate(month, day);
        
        // 触发自定义事件，通知其他模块，使用实际年份
        const customEvent = new CustomEvent('dateSelected', {
            detail: { year: actualYear, month, day, element: event.target }
        });
        document.dispatchEvent(customEvent);
    }

    /**
     * 更新选中日期的视觉状态
     * @param {number} month - 月份
     * @param {number} day - 日期
     */
    updateSelectedDate(month, day) {
        // 清除之前的选中状态
        this.datesGroup.querySelectorAll('.date-dot.selected').forEach(dot => {
            dot.classList.remove('selected');
        });

        // 设置新的选中状态
        const selectedDot = this.dateDots.get(`${month}-${day}`);
        if (selectedDot) {
            selectedDot.classList.add('selected');
        }
    }

    /**
     * 显示日期工具提示
     * @param {Event} event - 鼠标事件
     * @param {number} year - 年份（原始参数，保持兼容性）
     * @param {number} month - 月份
     * @param {number} day - 日期
     */
    showDateTooltip(event, year, month, day) {
        // 清除之前的隐藏定时器
        if (this.hideTooltipTimer) {
            clearTimeout(this.hideTooltipTimer);
            this.hideTooltipTimer = null;
        }
        
        const tooltip = this.getOrCreateTooltip();
        // 计算基于起始日期的实际年份
        const actualYear = this.calculateActualYear(month, day);
        const dateString = DateUtils.formatDate(actualYear, month, day);
        
        // 检查是否有记录
        const dateDot = this.dateDots.get(`${month}-${day}`);
        const hasRecord = dateDot && (dateDot.classList.contains('recorded') || dateDot.classList.contains('has-record'));
        const recordIndicator = hasRecord ? ' 📝' : '';
        
        tooltip.innerHTML = `
            <div class="tooltip-date">${dateString}</div>
            <div class="tooltip-info">${recordIndicator}</div>
        `;
        
        // 使用固定偏移量避免因元素变换导致的位置抖动
        const fixedOffsetX = 15;
        const fixedOffsetY = -35;
        
        // 获取鼠标位置（使用更稳定的坐标）
        const rect = event.target.getBoundingClientRect();
        const mouseX = rect.left + rect.width / 2;
        const mouseY = rect.top;
        
        // 计算初始位置
        let left = mouseX + fixedOffsetX;
        let top = mouseY + fixedOffsetY;
        
        // 设置初始位置以获取tooltip尺寸
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.classList.add('show');
        
        // 获取tooltip实际尺寸
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 调整位置避免超出屏幕边界
        if (left + tooltipRect.width > viewportWidth) {
            left = mouseX - tooltipRect.width - fixedOffsetX;
        }
        
        if (top < 0) {
            top = mouseY + Math.abs(fixedOffsetY);
        }
        
        // 应用最终位置
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /**
     * 隐藏工具提示
     */
    hideTooltip() {
        // 立即隐藏tooltip，避免闪烁
        if (this.hideTooltipTimer) {
            clearTimeout(this.hideTooltipTimer);
            this.hideTooltipTimer = null;
        }
        
        const tooltip = document.querySelector('.tooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }

    /**
     * 获取或创建工具提示元素
     * @returns {HTMLElement} 工具提示元素
     */
    getOrCreateTooltip() {
        let tooltip = document.querySelector('.tooltip');
        if (!tooltip) {
            tooltip = DOMUtils.createElement('div', { className: 'tooltip' });
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    /**
     * 标记日期为有记录状态
     * @param {number} month - 月份
     * @param {number} day - 日期
     */
    markDateAsRecorded(month, day) {
        const dateDot = this.dateDots.get(`${month}-${day}`);
        if (dateDot) {
            dateDot.classList.add('recorded');
            dateDot.classList.add('has-record'); // 添加兼容性类
        }
    }

    /**
     * 取消日期的记录状态标记
     * @param {number} month - 月份
     * @param {number} day - 日期
     */
    unmarkDateAsRecorded(month, day) {
        const dateDot = this.dateDots.get(`${month}-${day}`);
        if (dateDot) {
            dateDot.classList.remove('recorded');
            dateDot.classList.remove('has-record'); // 移除兼容性类
        }
    }

    /**
     * 绘制连接线
     * @param {string} recordId - 记录ID
     * @param {number} month - 月份
     * @param {number} day - 日期
     * @param {Object} recordPosition - 记录位置 {x, y, width, height}
     */
    drawConnectionLine(recordId, month, day, recordPosition, connectionLineData = null) {
        
        const dateDot = this.dateDots.get(`${month}-${day}`);
        if (!dateDot) {
            console.warn(`[CircleRenderer] 未找到日期小点: ${month}-${day}`);
            return;
        }

        // 获取日期小点的SVG坐标
        const dotSvgX = parseFloat(dateDot.getAttribute('cx'));
        const dotSvgY = parseFloat(dateDot.getAttribute('cy'));
        
        // SVG坐标系与画布容器坐标系是1:1对应的（viewBox设置为容器尺寸）
        // 因此SVG内的坐标就是相对于画布容器的坐标，无需转换
        const dotX = dotSvgX;
        const dotY = dotSvgY;

        // 直接使用传递过来的卡片尺寸（record-manager已经处理了尺寸获取的复杂逻辑）
        const cardWidth = recordPosition.width || 200;
        const cardHeight = recordPosition.height || 150;

        const connectionPoint = this.calculateClosestEdgePoint(
            dotX, dotY,
            recordPosition.x, recordPosition.y,
            cardWidth, cardHeight
        );

        // 创建折线路径 - V1.5更新：支持自定义连接线数据
        const path = this.createConnectionPath(dotX, dotY, connectionPoint.x, connectionPoint.y, connectionLineData);
        
        // 移除旧的连接线
        this.removeConnectionLine(recordId);

        // 创建新的连接线
        const connectionLine = DOMUtils.createSVGElement('path', {
            d: path,
            class: 'connection-line',
            'data-record-id': recordId
        });

        this.connectionsGroup.appendChild(connectionLine);
    }

    /**
     * 创建连接路径（折线）- V1.5更新：支持自定义连接线路径
     * @param {number} startX - 起始X坐标
     * @param {number} startY - 起始Y坐标
     * @param {number} endX - 结束X坐标
     * @param {number} endY - 结束Y坐标
     * @param {Object} connectionLineData - 连接线自定义数据（可选）
     * @returns {string} SVG路径字符串
     */
    createConnectionPath(startX, startY, endX, endY, connectionLineData = null) {
        // 如果有自定义连接线数据且已启用自定义模式
        if (connectionLineData && connectionLineData.isCustom) {
            // V1.5更新：支持新的pathPoints格式
            if (connectionLineData.pathPoints && connectionLineData.pathPoints.length > 0) {
                return this.createPathFromPoints(connectionLineData.pathPoints);
            }
            // 向后兼容：支持旧的segments格式
            else if (connectionLineData.segments && connectionLineData.segments.length > 0) {
                return this.createCustomConnectionPath(startX, startY, endX, endY, connectionLineData.segments);
            }
        }
        
        // 默认路径：计算中间点，创建直角折线
        const midX = startX + (endX - startX) * 0.5;
        const midY = startY;

        return `M ${startX} ${startY} L ${midX} ${midY} L ${midX} ${endY} L ${endX} ${endY}`;
    }

    /**
     * 从点数组创建路径 - V1.5新增
     * @param {Array} pathPoints - 路径点数组
     * @returns {string} SVG路径字符串
     */
    createPathFromPoints(pathPoints) {
        if (!pathPoints || pathPoints.length < 2) {
            console.warn('createPathFromPoints: 路径点数量不足', { pointsCount: pathPoints?.length });
            return '';
        }
        
        let path = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
        
        for (let i = 1; i < pathPoints.length; i++) {
            path += ` L ${pathPoints[i].x} ${pathPoints[i].y}`;
        }
        
        return path;
    }

    /**
     * 创建自定义连接路径 - V1.5新增（向后兼容）
     * @param {number} startX - 起始X坐标
     * @param {number} startY - 起始Y坐标
     * @param {number} endX - 结束X坐标
     * @param {number} endY - 结束Y坐标
     * @param {Array} segments - 线段偏移数据
     * @returns {string} SVG路径字符串
     */
    createCustomConnectionPath(startX, startY, endX, endY, segments) {
        const points = [{x: startX, y: startY}];
        
        // 默认中间点
        let currentX = startX + (endX - startX) * 0.5;
        let currentY = startY;
        
        // 应用自定义偏移
        segments.forEach((segment, index) => {
            if (segment.type === 'horizontal') {
                currentY += segment.offset;
            } else if (segment.type === 'vertical') {
                currentX += segment.offset;
            }
            
            points.push({x: currentX, y: currentY});
        });
        
        // 添加到终点的连接
        if (points[points.length - 1].x !== endX) {
            points.push({x: endX, y: points[points.length - 1].y});
        }
        points.push({x: endX, y: endY});
        
        // 生成路径字符串
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            path += ` L ${points[i].x} ${points[i].y}`;
        }
        
        return path;
    }

    /**
     * 移除连接线
     * @param {string} recordId - 记录ID
     */
    removeConnectionLine(recordId) {
        const existingLine = this.connectionsGroup.querySelector(`[data-record-id="${recordId}"]`);
        if (existingLine) {
            existingLine.remove();
        }

        // 同时清理连接线调整器中的控制手柄 - 修复删除记录后控制手柄残留问题
        if (window.connectionLineAdjuster && window.connectionLineAdjuster.getSelectedRecordId() === recordId) {
            window.connectionLineAdjuster.hideControlHandles();
        }
    }

    /**
     * 更新连接线位置
     * @param {string} recordId - 记录ID
     * @param {number} month - 月份
     * @param {number} day - 日期
     * @param {Object} newPosition - 新位置
     */
    updateConnectionLine(recordId, month, day, newPosition) {
        this.drawConnectionLine(recordId, month, day, newPosition);
    }

    /**
     * 高亮连接线
     * @param {string} recordId - 记录ID
     */
    highlightConnectionLine(recordId) {
        const line = this.connectionsGroup.querySelector(`[data-record-id="${recordId}"]`);
        if (line) {
            line.classList.add('highlighted');
        }
    }

    /**
     * 取消高亮连接线
     * @param {string} recordId - 记录ID
     */
    unhighlightConnectionLine(recordId) {
        const line = this.connectionsGroup.querySelector(`[data-record-id="${recordId}"]`);
        if (line) {
            line.classList.remove('highlighted');
        }
    }

    /**
     * 获取日期小点的位置
     * @param {number} month - 月份
     * @param {number} day - 日期
     * @returns {Object|null} 位置对象 {x, y}
     */
    getDateDotPosition(month, day) {
        const dateDot = this.dateDots.get(`${month}-${day}`);
        if (!dateDot) return null;

        return {
            x: parseFloat(dateDot.getAttribute('cx')),
            y: parseFloat(dateDot.getAttribute('cy'))
        };
    }

    /**
     * 响应窗口大小变化
     */
    handleResize() {
        this.initializeCanvas();
        this.renderCircle(this.currentYear);
        
        // 触发重新渲染事件
        const resizeEvent = new CustomEvent('circleResized', {
            detail: {
                centerX: this.centerX,
                centerY: this.centerY,
                radius: this.radius
            }
        });
        document.dispatchEvent(resizeEvent);
    }

    /**
     * 获取画布信息
     * @returns {Object} 画布信息
     */
    getCanvasInfo() {
        return {
            centerX: this.centerX,
            centerY: this.centerY,
            radius: this.radius,
            monthRadius: this.monthRadius,
            dateRadius: this.dateRadius,
            width: this.svg.getAttribute('width'),
            height: this.svg.getAttribute('height')
        };
    }

    /**
     * 计算记录卡片边缘最接近目标点的连接点
     * @param {number} targetX - 目标点X坐标（日期小点）
     * @param {number} targetY - 目标点Y坐标（日期小点）
     * @param {number} cardX - 卡片左上角X坐标
     * @param {number} cardY - 卡片左上角Y坐标
     * @param {number} cardWidth - 卡片宽度
     * @param {number} cardHeight - 卡片高度
     * @returns {Object} 连接点坐标 {x, y}
     */
    /**
     * 计算卡片边缘最近的连接点
     * @param {number} targetX - 目标点X坐标（日期小点）
     * @param {number} targetY - 目标点Y坐标（日期小点）
     * @param {number} cardX - 卡片X坐标
     * @param {number} cardY - 卡片Y坐标
     * @param {number} cardWidth - 卡片宽度
     * @param {number} cardHeight - 卡片高度
     * @returns {Object} 连接点坐标 {x, y}
     */
    calculateClosestEdgePoint(targetX, targetY, cardX, cardY, cardWidth, cardHeight) {
        
        // 定义最小连接线长度，避免生成过短的连接线
        const MIN_CONNECTION_LENGTH = 20;
        
        // 卡片的四个边界
        const left = cardX;
        const right = cardX + cardWidth;
        const top = cardY;
        const bottom = cardY + cardHeight;
                
        // 检查目标点是否在卡片内部或过于接近
        const isInsideOrTooClose = (
            targetX >= left - MIN_CONNECTION_LENGTH && 
            targetX <= right + MIN_CONNECTION_LENGTH &&
            targetY >= top - MIN_CONNECTION_LENGTH && 
            targetY <= bottom + MIN_CONNECTION_LENGTH
        );
        
        if (isInsideOrTooClose) {            // 如果目标点过于接近卡片，强制选择一个有足够距离的连接点
            return this.calculateForcedConnectionPoint(targetX, targetY, cardX, cardY, cardWidth, cardHeight, MIN_CONNECTION_LENGTH);
        }
        
        // 计算目标点到卡片四条边的最近点
        const edgePoints = [];
        
        // 左边最近点
        const leftPoint = {
            x: left,
            y: Math.max(top, Math.min(bottom, targetY)),
            distance: Math.sqrt(Math.pow(targetX - left, 2) + Math.pow(targetY - Math.max(top, Math.min(bottom, targetY)), 2))
        };
        edgePoints.push(leftPoint);
        
        // 右边最近点
        const rightPoint = {
            x: right,
            y: Math.max(top, Math.min(bottom, targetY)),
            distance: Math.sqrt(Math.pow(targetX - right, 2) + Math.pow(targetY - Math.max(top, Math.min(bottom, targetY)), 2))
        };
        edgePoints.push(rightPoint);
        
        // 上边最近点
        const topPoint = {
            x: Math.max(left, Math.min(right, targetX)),
            y: top,
            distance: Math.sqrt(Math.pow(targetX - Math.max(left, Math.min(right, targetX)), 2) + Math.pow(targetY - top, 2))
        };
        edgePoints.push(topPoint);
        
        // 下边最近点
        const bottomPoint = {
            x: Math.max(left, Math.min(right, targetX)),
            y: bottom,
            distance: Math.sqrt(Math.pow(targetX - Math.max(left, Math.min(right, targetX)), 2) + Math.pow(targetY - bottom, 2))
        };
        edgePoints.push(bottomPoint);
                
        // 过滤掉距离过短的连接点
        const validEdgePoints = edgePoints.filter(point => point.distance >= MIN_CONNECTION_LENGTH);
        
        if (validEdgePoints.length === 0) {
            return this.calculateForcedConnectionPoint(targetX, targetY, cardX, cardY, cardWidth, cardHeight, MIN_CONNECTION_LENGTH);
        }
        
        // 找到距离最近的有效边缘点
        validEdgePoints.sort((a, b) => a.distance - b.distance);
        const result = { x: validEdgePoints[0].x, y: validEdgePoints[0].y };
        
        return result;
    }

    /**
     * 当目标点过于接近卡片时，计算强制偏移的连接点
     * @param {number} targetX - 目标点X坐标
     * @param {number} targetY - 目标点Y坐标
     * @param {number} cardX - 卡片X坐标
     * @param {number} cardY - 卡片Y坐标
     * @param {number} cardWidth - 卡片宽度
     * @param {number} cardHeight - 卡片高度
     * @param {number} minDistance - 最小连接距离
     * @returns {Object} 连接点坐标 {x, y}
     */
    calculateForcedConnectionPoint(targetX, targetY, cardX, cardY, cardWidth, cardHeight, minDistance) {
        const centerX = cardX + cardWidth / 2;
        const centerY = cardY + cardHeight / 2;
        
        // 计算从卡片中心到目标点的方向向量
        const dx = targetX - centerX;
        const dy = targetY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 如果距离为0，使用默认方向
        if (distance === 0) {
            return { x: cardX - minDistance, y: centerY };
        }
        
        // 标准化方向向量
        const normalizedDx = dx / distance;
        const normalizedDy = dy / distance;
        
        // 计算卡片边界上的交点
        let connectionX, connectionY;
        
        // 根据方向确定与哪条边相交
        const absNormalizedDx = Math.abs(normalizedDx);
        const absNormalizedDy = Math.abs(normalizedDy);
        
        if (absNormalizedDx > absNormalizedDy) {
            // 主要是水平方向，与左右边相交
            if (normalizedDx > 0) {
                // 向右，与右边相交
                connectionX = cardX + cardWidth;
                connectionY = centerY + (connectionX - centerX) * normalizedDy / normalizedDx;
                connectionY = Math.max(cardY, Math.min(cardY + cardHeight, connectionY));
            } else {
                // 向左，与左边相交
                connectionX = cardX;
                connectionY = centerY + (connectionX - centerX) * normalizedDy / normalizedDx;
                connectionY = Math.max(cardY, Math.min(cardY + cardHeight, connectionY));
            }
        } else {
            // 主要是垂直方向，与上下边相交
            if (normalizedDy > 0) {
                // 向下，与下边相交
                connectionY = cardY + cardHeight;
                connectionX = centerX + (connectionY - centerY) * normalizedDx / normalizedDy;
                connectionX = Math.max(cardX, Math.min(cardX + cardWidth, connectionX));
            } else {
                // 向上，与上边相交
                connectionY = cardY;
                connectionX = centerX + (connectionY - centerY) * normalizedDx / normalizedDy;
                connectionX = Math.max(cardX, Math.min(cardX + cardWidth, connectionX));
            }
        }
        
        return { x: connectionX, y: connectionY };
    }

    /**
     * 绘制起始点指示器
     * 在起始点位置绘制三角形箭头和年份标记
     */
    drawStartPointIndicator() {
        // 如果没有设置起始日期，不绘制指示器
        if (!this.startDate) {
            return;
        }

        // 解析起始日期
        const { year, month, day } = DateUtils.parseDate(this.startDate);
        
        // 计算起始点在圆上的角度
        const dayOfYear = DateUtils.getDayOfYear(year, month, day);
        const totalDays = DateUtils.getDaysInYear(year);
        const angle = ((dayOfYear - 1) / totalDays) * 360 - 90; // 从12点位置开始
        
        // 计算起始点在圆上的位置
        const startPoint = MathUtils.getPointOnCircle(
            this.centerX, this.centerY, this.radius, angle
        );
        
        // 计算三角形箭头的位置（在圆外侧）
        const arrowDistance = this.radius + 15;
        const arrowPoint = MathUtils.getPointOnCircle(
            this.centerX, this.centerY, arrowDistance, angle
        );
        
        // 计算三角形的三个顶点
        const arrowSize = 8;
        const angleRad = MathUtils.degreesToRadians(angle);
        
        // 箭头指向圆心的方向
        const tipX = arrowPoint.x;
        const tipY = arrowPoint.y;
        
        // 计算垂直于半径方向的两个底点
        const perpAngle1 = angleRad + Math.PI / 2;
        const perpAngle2 = angleRad - Math.PI / 2;
        
        const base1X = tipX + Math.cos(perpAngle1) * arrowSize / 2 + Math.cos(angleRad + Math.PI) * arrowSize;
        const base1Y = tipY + Math.sin(perpAngle1) * arrowSize / 2 + Math.sin(angleRad + Math.PI) * arrowSize;
        const base2X = tipX + Math.cos(perpAngle2) * arrowSize / 2 + Math.cos(angleRad + Math.PI) * arrowSize;
        const base2Y = tipY + Math.sin(perpAngle2) * arrowSize / 2 + Math.sin(angleRad + Math.PI) * arrowSize;
        
        // 创建三角形箭头路径
        const arrowPath = DOMUtils.createSVGElement('path', {
            d: `M ${tipX} ${tipY} L ${base1X} ${base1Y} L ${base2X} ${base2Y} Z`,
            class: 'start-point-arrow',
            fill: '#ff4757',
            stroke: '#ff4757',
            'stroke-width': '1'
        });
        
        this.monthsGroup.appendChild(arrowPath);
        
        // 绘制年份标记
        this.drawYearLabels(angle, arrowPoint);
    }

    /**
     * 绘制年份标记文本
     * @param {number} angle - 起始点角度
     * @param {Object} arrowPoint - 箭头位置
     */
    drawYearLabels(angle, arrowPoint) {
        // 获取起始日期的年份信息
        const [year, month, day] = this.startDate.split('-').map(Number);
        const currentYear = year;
        const nextYear = year + 1;
        
        // 计算角度的弧度值
        const angleRad = MathUtils.degreesToRadians(angle);
        
        // 计算沿圆周的偏移角度（用于定位文本）
        const offsetAngleDegrees = 5; // 沿圆周偏移5度
        const offsetAngleRad = MathUtils.degreesToRadians(offsetAngleDegrees);
        
        // 使用与三角形相同的半径，确保视觉距离一致
        const yearLabelRadius = this.radius + 15;
        
        // 计算2025的位置（逆时针偏移，在箭头左边）
        const currentYearAngle = angleRad - offsetAngleRad;
        const currentYearAngleDegrees = MathUtils.radiansToDegrees(currentYearAngle);
        const currentYearX = this.centerX + yearLabelRadius * Math.cos(currentYearAngle);
        const currentYearY = this.centerY + yearLabelRadius * Math.sin(currentYearAngle);
        
        // 计算2024的位置（顺时针偏移，在箭头右边）
        const nextYearAngle = angleRad + offsetAngleRad;
        const nextYearAngleDegrees = MathUtils.radiansToDegrees(nextYearAngle);
        const nextYearX = this.centerX + yearLabelRadius * Math.cos(nextYearAngle);
        const nextYearY = this.centerY + yearLabelRadius * Math.sin(nextYearAngle);
        
        // 计算各自位置的切线角度
        // 切线方向是半径方向逆时针旋转90度
        const currentYearTangentAngle = MathUtils.radiansToDegrees(currentYearAngle + Math.PI / 2);
        const nextYearTangentAngle = MathUtils.radiansToDegrees(nextYearAngle + Math.PI / 2);
        
        // 创建2025年份文本（在箭头左边，逆时针方向）
        const currentYearText = DOMUtils.createSVGElement('text', {
            x: currentYearX,
            y: currentYearY,
            class: 'start-point-year-label current-year',
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            transform: `rotate(${currentYearTangentAngle} ${currentYearX} ${currentYearY})`
        });
        currentYearText.textContent = nextYear.toString(); // 显示2025
        
        // 创建2024年份文本（在箭头右边，顺时针方向）
        const nextYearText = DOMUtils.createSVGElement('text', {
            x: nextYearX,
            y: nextYearY,
            class: 'start-point-year-label next-year',
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            transform: `rotate(${nextYearTangentAngle} ${nextYearX} ${nextYearY})`
        });
        nextYearText.textContent = currentYear.toString(); // 显示2024
        
        // 添加到SVG
        this.monthsGroup.appendChild(currentYearText);
        this.monthsGroup.appendChild(nextYearText);
    }
}

// 监听窗口大小变化
window.addEventListener('resize', debounce(() => {
    if (window.circleRenderer) {
        window.circleRenderer.handleResize();
    }
}, 250));

// 导出到全局
window.CircleRenderer = CircleRenderer;