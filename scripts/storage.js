/**
 * 存储管理器 - V1.4升级版
 * 负责本地数据的保存、加载、导入导出功能
 * 优先使用本地文件存储，降级到localStorage
 * 支持File System Access API和传统文件操作
 */

class StorageManager {
    constructor() {
        this.storageKey = 'year_circle_data';
        this.currentYear = new Date().getFullYear();
        this.autoSaveEnabled = true;
        this.autoSaveDelay = 1000; // 1秒延迟自动保存
        this.autoSaveTimer = null;
        
        // V1.4新增：文件存储相关属性
        this.preferFileStorage = this.loadStoragePreference(); // 从保存的设置中恢复存储偏好
        this.hasUnsavedChanges = false; // 未保存更改标记
        this.lastSaveTime = null; // 最后保存时间
        
        // 初始化页面关闭前确认
        this.initBeforeUnloadHandler();
    }

    /**
     * 获取存储键名
     * @param {number} year - 年份
     * @returns {string} 存储键名
     */
    getStorageKey(year) {
        return `${this.storageKey}_${year}`;
    }

    /**
     * V1.4新增：从 localStorage 加载存储偏好设置
     * @returns {boolean} 存储偏好设置（默认为浏览器存储）
     */
    loadStoragePreference() {
        try {
            const preference = localStorage.getItem('year_circle_storage_preference');
            console.log(`[StorageManager] localStorage中的存储偏好原始值: "${preference}"`);
            
            if (preference !== null) {
                const useFileStorage = preference === 'file';
                console.log(`[StorageManager] 已恢复存储偏好设置: ${useFileStorage ? '文件存储' : '浏览器存储'}`);
                return useFileStorage;
            }
        } catch (error) {
            console.warn('[StorageManager] 无法加载存储偏好设置:', error);
        }
        
        // 默认使用浏览器存储（更稳定）
        console.log('[StorageManager] 使用默认存储偏好设置: 浏览器存储');
        return false;
    }

    /**
     * V1.4新增：保存存储偏好设置到 localStorage
     * @param {boolean} preferFileStorage - 是否偏好文件存储
     */
    saveStoragePreference(preferFileStorage) {
        try {
            const preference = preferFileStorage ? 'file' : 'browser';
            localStorage.setItem('year_circle_storage_preference', preference);
            this.preferFileStorage = preferFileStorage;
            console.log(`[StorageManager] 存储偏好设置已保存: ${preferFileStorage ? '文件存储' : '浏览器存储'}`);
        } catch (error) {
            console.error('[StorageManager] 无法保存存储偏好设置:', error);
        }
    }

    /**
     * V1.4升级：保存年度数据（优先文件存储，降级localStorage）
     * @param {number} year - 年份
     * @param {Object} data - 要保存的数据
     * @returns {Promise<boolean>} 保存是否成功
     */
    async saveYearData(year, data) {
        try {
            // 添加时间戳和版本信息
            data.lastModified = new Date().toISOString();
            data.version = '1.4';
            
            let saveSuccess = false;
            
            // 优先尝试文件存储
            if (this.preferFileStorage && window.fileStorageManager) {
                const startDate = this.getStartDate(year);
                saveSuccess = await window.fileStorageManager.saveToFile(year, data, startDate);
                
                if (saveSuccess) {
                    console.log(`[StorageManager] 数据已保存到文件: ${year}年`);
                    this.markAsSaved();
                    return true;
                }
            }
            
            // 降级到localStorage
            saveSuccess = this.saveToLocalStorage(year, data);
            if (saveSuccess) {
                console.log(`[StorageManager] 数据已保存到localStorage: ${year}年`);
                this.markAsSaved();
            }
            
            return saveSuccess;
        } catch (error) {
            console.error('[StorageManager] 保存失败:', error);
            this.showError('保存失败，请重试');
            return false;
        }
    }

    /**
     * 保存到localStorage（内部方法）
     * @param {number} year - 年份
     * @param {Object} data - 要保存的数据
     * @returns {boolean} 保存是否成功
     */
    saveToLocalStorage(year, data) {
        try {
            const key = this.getStorageKey(year);
            const jsonData = JSON.stringify(data);
            
            // 检查存储空间
            if (jsonData.length > 5 * 1024 * 1024) { // 5MB限制
                this.showError('数据过大，无法保存到浏览器存储');
                return false;
            }
            
            localStorage.setItem(key, jsonData);
            return true;
        } catch (error) {
            this.showError('保存失败，存储空间可能不足');
            return false;
        }
    }

    /**
     * V1.4升级：加载年度数据（优先文件存储，降级localStorage）
     * @param {number} year - 年份
     * @returns {Promise<Object|null>} 加载的数据，失败时返回null
     */
    async loadYearData(year) {
        try {
            console.log(`[StorageManager] 开始加载${year}年数据，存储偏好: ${this.preferFileStorage ? '文件存储' : '浏览器存储'}`);
            let data = null;
            
            // 优先尝试从文件加载
            if (this.preferFileStorage && window.fileStorageManager) {
                console.log(`[StorageManager] 尝试从文件加载${year}年数据`);
                
                // 直接从localStorage获取起始日期，避免循环调用
                const startDateKey = `${this.storageKey}_startDate_${year}`;
                const startDate = localStorage.getItem(startDateKey);
                console.log(`[StorageManager] 获取起始日期: ${startDate}`);
                
                data = await window.fileStorageManager.loadFromFile(year, startDate);
                console.log(`[StorageManager] 文件加载结果:`, data ? '成功' : '失败');
                
                if (data && this.validateDataFormat(data)) {
                    console.log(`[StorageManager] 数据已从文件加载: ${year}年`);
                    return data;
                } else if (data) {
                    console.warn(`[StorageManager] 文件数据格式验证失败: ${year}年`);
                }
            } else {
                console.log(`[StorageManager] 跳过文件加载，preferFileStorage: ${this.preferFileStorage}, fileStorageManager: ${!!window.fileStorageManager}`);
            }
            
            // 降级到localStorage
            console.log(`[StorageManager] 尝试从localStorage加载${year}年数据`);
            data = this.loadFromLocalStorage(year);
            if (data) {
                console.log(`[StorageManager] 数据已从localStorage加载: ${year}年`);
            } else {
                console.log(`[StorageManager] localStorage中没有${year}年数据`);
            }
            
            return data;
        } catch (error) {
            console.error(`[StorageManager] 加载${year}年数据失败:`, error);
            this.showError(`加载${year}年数据失败`);
            return null;
        }
    }

    /**
     * 从localStorage加载数据（内部方法）
     * @param {number} year - 年份
     * @returns {Object|null} 加载的数据，失败时返回null
     */
    loadFromLocalStorage(year) {
        try {
            const key = this.getStorageKey(year);
            const data = localStorage.getItem(key);
            
            if (data) {
                const parsedData = JSON.parse(data);
                
                // 验证数据格式
                if (this.validateDataFormat(parsedData)) {
                    return parsedData;
                } else {
                    this.showError(`${year}年的数据格式无效`);
                    return null;
                }
            }
            
            return null;
        } catch (error) {
            this.showError(`从localStorage加载${year}年数据失败`);
            return null;
        }
    }

    /**
     * 验证数据格式
     * @param {Object} data - 要验证的数据
     * @returns {boolean} 数据格式是否有效
     */
    validateDataFormat(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // 检查必需字段
        if (!data.year || !data.records || !Array.isArray(data.records)) {
            return false;
        }

        // 验证记录格式
        for (const record of data.records) {
            if (!this.validateRecordFormat(record)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 验证单条记录格式
     * @param {Object} record - 要验证的记录
     * @returns {boolean} 记录格式是否有效
     */
    validateRecordFormat(record) {
        const requiredFields = ['id', 'date', 'type', 'content', 'position', 'size'];
        
        for (const field of requiredFields) {
            if (!(field in record)) {
                return false;
            }
        }

        // 验证记录类型
        if (!['text', 'image'].includes(record.type)) {
            return false;
        }

        // 验证位置和尺寸
        if (!record.position.x || !record.position.y || !record.size.width || !record.size.height) {
            return false;
        }

        // 验证边框颜色（可选字段）
        if (record.borderColor && !['classic', 'warm', 'fresh', 'elegant', 'soft'].includes(record.borderColor)) {
            return false;
        }

        return true;
    }

    /**
     * 删除年度数据
     * @param {number} year - 年份
     * @returns {boolean} 删除是否成功
     */
    deleteYearData(year) {
        try {
            const key = this.getStorageKey(year);
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            this.showError(`删除${year}年数据失败`);
            return false;
        }
    }

    /**
     * 获取所有已保存的年份列表
     * @returns {Array<number>} 年份列表
     */
    getSavedYears() {
        const years = [];
        const prefix = `${this.storageKey}_`;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                const year = parseInt(key.replace(prefix, ''));
                if (!isNaN(year)) {
                    years.push(year);
                }
            }
        }
        
        return years.sort((a, b) => b - a); // 按年份降序排列
    }

    /**
     * 导出年度数据为JSON文件
     * @param {number} year - 年份
     */
    exportYearData(year) {
        try {
            const data = this.loadYearData(year);
            if (!data) {
                this.showError(`${year}年没有数据可导出`);
                return null;
            }

            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `year_circle_${year}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return data;
        } catch (error) {
            this.showError('导出失败');
            return null;
        }
    }

    /**
     * 从JSON文件导入年度数据
     * @param {File} file - JSON文件
     * @returns {Promise<Object|null>} 导入的数据
     */
    async importYearData(file) {
        try {
            if (!FileUtils.validateFileType(file, ['application/json', 'text/'])) {
                this.showError('请选择有效的JSON文件');
                return null;
            }

            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);

            if (!this.validateDataFormat(data)) {
                this.showError('文件格式无效，请检查JSON数据结构');
                return null;
            }

            // 询问是否覆盖现有数据
            const existingData = this.loadYearData(data.year);
            if (existingData) {
                const confirmed = confirm(`${data.year}年的数据已存在，是否覆盖？`);
                if (!confirmed) {
                    return null;
                }
            }

            // 保存导入的数据
            if (this.saveYearData(data.year, data)) {
                return data;
            } else {
                this.showError('数据导入失败');
                return null;
            }
        } catch (error) {
            this.showError('导入失败，请检查文件格式');
            return null;
        }
    }

    /**
     * 读取文件为文本
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文件内容
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * 启用自动保存
     * @param {Function} saveCallback - 保存回调函数
     */
    enableAutoSave(saveCallback) {
        this.autoSaveEnabled = true;
        this.saveCallback = saveCallback;
    }

    /**
     * 禁用自动保存
     */
    disableAutoSave() {
        this.autoSaveEnabled = false;
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * 触发自动保存
     */
    triggerAutoSave() {
        if (!this.autoSaveEnabled || !this.saveCallback) {
            return;
        }

        // 标记有未保存的更改
        this.markAsUnsaved();

        // 清除之前的定时器
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // 设置新的定时器
        this.autoSaveTimer = setTimeout(async () => {
            await this.saveCallback();
            this.autoSaveTimer = null;
        }, this.autoSaveDelay);
    }

    /**
     * V1.4新增：标记为有未保存的更改
     */
    markAsUnsaved() {
        this.hasUnsavedChanges = true;
        this.updatePageTitle();
    }

    /**
     * V1.4新增：标记为已保存
     */
    markAsSaved() {
        this.hasUnsavedChanges = false;
        this.lastSaveTime = new Date();
        this.updatePageTitle();
    }

    /**
     * V1.4新增：更新页面标题显示未保存状态
     */
    updatePageTitle() {
        const baseTitle = '环形月份图画布';
        if (this.hasUnsavedChanges) {
            document.title = `* ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }

    /**
     * V1.4新增：初始化页面关闭前确认处理器
     */
    initBeforeUnloadHandler() {
        window.addEventListener('beforeunload', (event) => {
            if (this.hasUnsavedChanges) {
                const message = '您有未保存的更改，确定要离开吗？';
                event.preventDefault();
                event.returnValue = message;
                return message;
            }
        });
    }

    /**
     * V1.4新增：数据迁移功能 - 从localStorage迁移到本地文件
     * @returns {Promise<Object>} 迁移结果统计
     */
    async migrateToFileStorage() {
        if (!window.fileStorageManager || !window.fileStorageManager.isSupported()) {
            throw new Error('文件存储不支持，无法进行数据迁移');
        }

        const migrationStats = {
            total: 0,
            success: 0,
            failed: 0,
            errors: []
        };

        try {
            const savedYears = this.getSavedYears();
            migrationStats.total = savedYears.length;

            for (const year of savedYears) {
                try {
                    // 从localStorage加载数据
                    const data = this.loadFromLocalStorage(year);
                    if (!data) {
                        migrationStats.failed++;
                        migrationStats.errors.push(`${year}年: 无法从localStorage读取数据`);
                        continue;
                    }

                    // 保存到文件
                    const startDate = this.getStartDate(year);
                    const success = await window.fileStorageManager.saveToFile(year, data, startDate);
                    
                    if (success) {
                        migrationStats.success++;
                        console.log(`[StorageManager] 数据迁移成功: ${year}年`);
                    } else {
                        migrationStats.failed++;
                        migrationStats.errors.push(`${year}年: 文件保存失败`);
                    }
                } catch (error) {
                    migrationStats.failed++;
                    migrationStats.errors.push(`${year}年: ${error.message}`);
                    console.error(`[StorageManager] 迁移${year}年数据失败:`, error);
                }
            }

            // 显示迁移结果
            if (migrationStats.success > 0) {
                this.showSuccess(`数据迁移完成：成功 ${migrationStats.success} 个，失败 ${migrationStats.failed} 个`);
            }

            if (migrationStats.failed > 0) {
                console.warn('[StorageManager] 迁移失败详情:', migrationStats.errors);
            }

            return migrationStats;
        } catch (error) {
            console.error('[StorageManager] 数据迁移过程出错:', error);
            throw error;
        }
    }

    /**
     * V1.4新增：检查是否需要数据迁移
     * @returns {boolean} 是否需要迁移
     */
    needsMigration() {
        // 检查是否有localStorage数据但文件存储可用
        const savedYears = this.getSavedYears();
        return savedYears.length > 0 && 
               window.fileStorageManager && 
               window.fileStorageManager.isSupported() &&
               this.preferFileStorage;
    }

    /**
     * 获取存储使用情况
     * @returns {Object} 存储使用情况信息
     */
    getStorageInfo() {
        let totalSize = 0;
        let yearDataSizes = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = new Blob([value]).size;
            totalSize += size;

            if (key.startsWith(this.storageKey)) {
                const year = key.replace(`${this.storageKey}_`, '');
                yearDataSizes[year] = size;
            }
        }

        return {
            totalSize: totalSize,
            yearDataSizes: yearDataSizes,
            availableSpace: this.getAvailableSpace(),
            usagePercentage: (totalSize / (5 * 1024 * 1024)) * 100 // 假设5MB限制
        };
    }

    /**
     * 获取可用存储空间（估算）
     * @returns {number} 可用空间（字节）
     */
    getAvailableSpace() {
        try {
            // 尝试存储测试数据来估算可用空间
            const testKey = 'storage_test';
            const testData = 'x'.repeat(1024); // 1KB测试数据
            let availableSpace = 0;

            for (let i = 0; i < 5000; i++) { // 最多测试5MB
                try {
                    localStorage.setItem(testKey, testData.repeat(i));
                    availableSpace = i * 1024;
                } catch (e) {
                    break;
                }
            }

            localStorage.removeItem(testKey);
            return availableSpace;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 清理过期数据
     * @param {number} daysToKeep - 保留天数
     */
    cleanupOldData(daysToKeep = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const years = this.getSavedYears();
        let deletedCount = 0;

        years.forEach(year => {
            const data = this.loadYearData(year);
            if (data && data.lastModified) {
                const lastModified = new Date(data.lastModified);
                if (lastModified < cutoffDate) {
                    this.deleteYearData(year);
                    deletedCount++;
                }
            }
        });
    }

    /**
     * 显示错误信息
     * @param {string} message - 错误信息
     */
    showError(message) {
        // 这里可以集成到应用的通知系统
        alert(message); // 临时使用alert，后续可以替换为更好的UI
    }

    /**
     * 显示成功信息
     * @param {string} message - 成功信息
     */
    showSuccess(message) {
        // 这里可以集成到应用的通知系统
    }

    /**
     * V1.2新增：保存年度起始日期
     * @param {number} year - 年份
     * @param {string} startDate - 起始日期 (YYYY-MM-DD格式)
     * @returns {boolean} 保存是否成功
     */
    saveStartDate(year, startDate) {
        try {
            console.log(`[StorageManager] 保存起始日期: 年份=${year}, 日期=${startDate}`);
            
            // 使用与loadYearData一致的键名格式
            const startDateKey = `${this.storageKey}_startDate_${year}`;
            localStorage.setItem(startDateKey, startDate);
            
            // 同时更新年度数据中的起始日期（如果存在的话）
            const dataKey = this.getStorageKey(year);
            const existingDataStr = localStorage.getItem(dataKey);
            if (existingDataStr) {
                try {
                    const existingData = JSON.parse(existingDataStr);
                    existingData.startDate = startDate;
                    localStorage.setItem(dataKey, JSON.stringify(existingData));
                } catch (parseError) {
                    console.warn(`[StorageManager] 更新年度数据中的起始日期失败:`, parseError);
                }
            }
            
            console.log(`[StorageManager] 起始日期保存成功`);
            return true;
        } catch (error) {
            console.error(`[StorageManager] 保存起始日期失败:`, error);
            return false;
        }
    }

    /**
     * V1.2新增：获取年度起始日期
     * @param {number} year - 年份
     * @returns {string|null} 起始日期 (YYYY-MM-DD格式)，未设置时返回null
     */
    getStartDate(year) {
        try {
            // 使用与loadYearData一致的键名格式
            const startDateKey = `${this.storageKey}_startDate_${year}`;
            const startDate = localStorage.getItem(startDateKey);
            console.log(`[StorageManager] 获取起始日期: 年份=${year}, 日期=${startDate} (键名: ${startDateKey})`);
            return startDate;
        } catch (error) {
            console.error(`[StorageManager] 获取起始日期失败:`, error);
            return null;
        }
    }

    /**
     * V1.4新增：重置起始日期（删除保存的起始日期）
     * @param {number} year 年份
     * @returns {boolean} 操作是否成功
     */
    resetStartDate(year) {
        return this.saveStartDate(year, null);
    }

    /**
     * 保存当前选择的年份
     * @param {number} year - 当前年份
     * @returns {boolean} 保存是否成功
     */
    saveCurrentYear(year) {
        try {
            localStorage.setItem('year_circle_current_year', year.toString());
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取上次选择的年份
     * @returns {number} 年份，如果没有保存过则返回当前年份
     */
    getCurrentYear() {
        try {
            const savedYear = localStorage.getItem('year_circle_current_year');
            if (savedYear) {
                const year = parseInt(savedYear, 10);
                if (!isNaN(year) && year > 1900 && year < 3000) {
                    return year;
                }
            }
        } catch (error) {
            // 静默处理错误
        }
        return new Date().getFullYear();
    }
}

// 创建全局存储管理器实例
window.storageManager = new StorageManager();