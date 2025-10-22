/**
 * 工具函数库
 * 包含日期计算、数学计算、DOM操作等通用工具函数
 */

/**
 * 日期工具类
 * 提供年份、月份、日期相关的计算功能
 */
class DateUtils {
    /**
     * 判断是否为闰年
     * @param {number} year - 年份
     * @returns {boolean} 是否为闰年
     */
    static isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    /**
     * 获取指定年份月份的天数
     * @param {number} year - 年份
     * @param {number} month - 月份 (1-12)
     * @returns {number} 该月的天数
     */
    static getDaysInMonth(year, month) {
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (month === 2 && this.isLeapYear(year)) {
            return 29;
        }
        return daysInMonth[month - 1];
    }

    /**
     * 获取指定年份的总天数
     * @param {number} year - 年份
     * @returns {number} 该年的总天数
     */
    static getDaysInYear(year) {
        return this.isLeapYear(year) ? 366 : 365;
    }

    /**
     * 获取月份名称
     * @param {number} month - 月份 (1-12)
     * @param {string} locale - 语言环境，默认为中文
     * @returns {string} 月份名称
     */
    static getMonthName(month, locale = 'zh-CN') {
        const monthNames = {
            'zh-CN': ['一月', '二月', '三月', '四月', '五月', '六月',
                     '七月', '八月', '九月', '十月', '十一月', '十二月'],
            'en-US': ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December']
        };
        return monthNames[locale][month - 1];
    }

    /**
     * 格式化日期字符串
     * @param {number} year - 年份
     * @param {number} month - 月份
     * @param {number} day - 日期
     * @returns {string} 格式化的日期字符串 (YYYY-MM-DD)
     */
    static formatDate(year, month, day) {
        // 参数验证，防止undefined导致错误
        if (year === undefined || month === undefined || day === undefined) {
            return 'Invalid Date';
        }
        
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }

    /**
     * 解析日期字符串
     * @param {string} dateString - 日期字符串 (YYYY-MM-DD)
     * @returns {Object} 包含年、月、日的对象
     */
    static parseDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return { year, month, day };
    }

    /**
     * 格式化日期字符串为可读格式
     * @param {string} dateString - 日期字符串 (YYYY-MM-DD)
     * @returns {string} 格式化的日期字符串 (YYYY年MM月DD日)
     */
    static formatDateString(dateString) {
        if (!dateString || typeof dateString !== 'string') {
            return 'Invalid Date';
        }
        
        try {
            const { year, month, day } = this.parseDate(dateString);
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                return 'Invalid Date';
            }
            return `${year}年${month.toString().padStart(2, '0')}月${day.toString().padStart(2, '0')}日`;
        } catch (error) {
            return 'Invalid Date';
        }
    }

    /**
     * 获取一年中某个日期是第几天
     * @param {number} year - 年份
     * @param {number} month - 月份 (1-12)
     * @param {number} day - 日期
     * @returns {number} 该日期在年中的天数
     */
    static getDayOfYear(year, month, day) {
        let dayOfYear = 0;
        for (let m = 1; m < month; m++) {
            dayOfYear += this.getDaysInMonth(year, m);
        }
        return dayOfYear + day;
    }
}

/**
 * 数学工具类
 * 提供角度计算、坐标转换等数学功能
 */
class MathUtils {
    /**
     * 将角度转换为弧度
     * @param {number} degrees - 角度
     * @returns {number} 弧度
     */
    static degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * 将弧度转换为角度
     * @param {number} radians - 弧度
     * @returns {number} 角度
     */
    static radiansToDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * 计算圆周上的点坐标
     * @param {number} centerX - 圆心X坐标
     * @param {number} centerY - 圆心Y坐标
     * @param {number} radius - 半径
     * @param {number} angle - 角度（度）
     * @returns {Object} 包含x、y坐标的对象
     */
    static getPointOnCircle(centerX, centerY, radius, angle) {
        const radians = this.degreesToRadians(angle);
        return {
            x: centerX + radius * Math.cos(radians),
            y: centerY + radius * Math.sin(radians)
        };
    }

    /**
     * 计算两点之间的距离
     * @param {number} x1 - 第一个点的X坐标
     * @param {number} y1 - 第一个点的Y坐标
     * @param {number} x2 - 第二个点的X坐标
     * @param {number} y2 - 第二个点的Y坐标
     * @returns {number} 两点之间的距离
     */
    static getDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * 将数值限制在指定范围内
     * @param {number} value - 要限制的数值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 限制后的数值
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * 线性插值
     * @param {number} start - 起始值
     * @param {number} end - 结束值
     * @param {number} t - 插值参数 (0-1)
     * @returns {number} 插值结果
     */
    static lerp(start, end, t) {
        return start + (end - start) * t;
    }
}

/**
 * DOM工具类
 * 提供DOM操作相关的工具函数
 */
class DOMUtils {
    /**
     * 创建SVG元素
     * @param {string} tagName - 标签名
     * @param {Object} attributes - 属性对象
     * @returns {SVGElement} 创建的SVG元素
     */
    static createSVGElement(tagName, attributes = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return element;
    }

    /**
     * 创建HTML元素
     * @param {string} tagName - 标签名
     * @param {Object} attributes - 属性对象
     * @param {string} textContent - 文本内容
     * @returns {HTMLElement} 创建的HTML元素
     */
    static createElement(tagName, attributes = {}, textContent = '') {
        const element = document.createElement(tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        if (textContent) {
            element.textContent = textContent;
        }
        return element;
    }

    /**
     * 获取元素的边界矩形
     * @param {HTMLElement} element - 目标元素
     * @returns {DOMRect} 边界矩形
     */
    static getBoundingRect(element) {
        return element.getBoundingClientRect();
    }

    /**
     * 检查点是否在元素内
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {HTMLElement} element - 目标元素
     * @returns {boolean} 是否在元素内
     */
    static isPointInElement(x, y, element) {
        const rect = this.getBoundingRect(element);
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    /**
     * 添加事件监听器
     * @param {HTMLElement} element - 目标元素
     * @param {string} event - 事件名称
     * @param {Function} handler - 事件处理函数
     * @param {Object} options - 选项
     */
    static addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
    }

    /**
     * 移除事件监听器
     * @param {HTMLElement} element - 目标元素
     * @param {string} event - 事件名称
     * @param {Function} handler - 事件处理函数
     */
    static removeEventListener(element, event, handler) {
        element.removeEventListener(event, handler);
    }
}

/**
 * 颜色工具类
 * 提供颜色处理相关的工具函数
 */
class ColorUtils {
    /**
     * 将十六进制颜色转换为RGB
     * @param {string} hex - 十六进制颜色值
     * @returns {Object} RGB颜色对象
     */
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * 将RGB颜色转换为十六进制
     * @param {number} r - 红色值 (0-255)
     * @param {number} g - 绿色值 (0-255)
     * @param {number} b - 蓝色值 (0-255)
     * @returns {string} 十六进制颜色值
     */
    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    /**
     * 获取颜色的透明度版本
     * @param {string} color - 颜色值
     * @param {number} alpha - 透明度 (0-1)
     * @returns {string} RGBA颜色值
     */
    static addAlpha(color, alpha) {
        const rgb = this.hexToRgb(color);
        if (rgb) {
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        }
        return color;
    }
}

/**
 * 文件工具类
 * 提供文件处理相关的工具函数
 */
class FileUtils {
    /**
     * 读取文件为Base64
     * @param {File} file - 文件对象
     * @returns {Promise<string>} Base64字符串
     */
    static readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 下载数据为文件
     * @param {string} data - 数据内容
     * @param {string} filename - 文件名
     * @param {string} mimeType - MIME类型
     */
    static downloadFile(data, filename, mimeType = 'text/plain') {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * 验证文件类型
     * @param {File} file - 文件对象
     * @param {Array<string>} allowedTypes - 允许的文件类型
     * @returns {boolean} 是否为允许的文件类型
     */
    static validateFileType(file, allowedTypes) {
        return allowedTypes.some(type => file.type.startsWith(type));
    }
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 生成唯一ID
 * @param {string} prefix - 前缀
 * @returns {string} 唯一ID
 */
function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 导出工具类和函数
window.DateUtils = DateUtils;
window.MathUtils = MathUtils;
window.DOMUtils = DOMUtils;
window.ColorUtils = ColorUtils;
window.FileUtils = FileUtils;
window.debounce = debounce;
window.throttle = throttle;
window.generateId = generateId;