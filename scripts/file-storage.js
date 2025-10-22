/**
 * 文件存储管理器 - V1.4新增
 * 负责本地文件系统的存储操作，支持File System Access API
 * 提供localStorage的升级替代方案，解决浏览器存储限制问题
 */

class FileStorageManager {
    constructor() {
        this.isFileSystemSupported = false;
        this.directoryHandle = null;
        this.storageDirectory = null;
        this.fallbackToLocalStorage = true;
        this.dbInitialized = false;
        
        // 初始化检查浏览器支持
        this.checkBrowserSupport();
        
        // 初始化IndexedDB
        this.initializeDatabase().then(() => {
            // 如果支持，尝试恢复之前保存的目录句柄
            if (this.isFileSystemSupported) {
                this.restoreDirectoryHandle().then(() => {
                    // 目录恢复完成后，通知主应用更新UI
                    if (window.app && window.app.updateStorageUI) {
                        window.app.updateStorageUI();
                    }
                });
            }
        });
    }

    /**
     * 初始化IndexedDB数据库
     * @returns {Promise} 初始化完成的Promise
     */
    async initializeDatabase() {
        if (this.dbInitialized) return;

        return new Promise((resolve, reject) => {
            try {
                
                // 先检查数据库是否存在且对象存储是否正确
                const checkRequest = indexedDB.open('YearCircleStorage');
                
                checkRequest.onsuccess = (event) => {
                    const db = event.target.result;
                    
                    // 如果数据库存在但对象存储为空，删除数据库重新创建
                    if (db.objectStoreNames.length === 0) {
                        db.close();
                        
                        const deleteRequest = indexedDB.deleteDatabase('YearCircleStorage');
                        deleteRequest.onsuccess = () => {
                            this.createDatabase(resolve, reject);
                        };
                        deleteRequest.onerror = (error) => {
                            reject(error);
                        };
                    } else {
                        // 数据库正常，直接使用
                        this.db = db;
                        this.dbInitialized = true;
                        console.log('[FileStorageManager] 使用现有数据库');
                        resolve();
                    }
                };
                
                checkRequest.onerror = () => {
                    // 数据库不存在，创建新的
                    console.log('[FileStorageManager] 数据库不存在，创建新的');
                    this.createDatabase(resolve, reject);
                };
            } catch (error) {
                console.error('[FileStorageManager] IndexedDB初始化异常:', error);
                reject(error);
            }
        });
    }

    createDatabase(resolve, reject) {
        const request = indexedDB.open('YearCircleStorage', 2);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('directories')) {
                db.createObjectStore('directories');
            }
            
            if (!db.objectStoreNames.contains('records')) {
                db.createObjectStore('records');
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.dbInitialized = true;
            resolve();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    }

    /**
     * 检查浏览器对File System Access API的支持
     * @returns {boolean} 是否支持File System Access API
     */
    checkBrowserSupport() {
        try {
            // 检查File System Access API支持
            this.isFileSystemSupported = 'showDirectoryPicker' in window && 
                                       'showOpenFilePicker' in window && 
                                       'showSaveFilePicker' in window;
            
            
            if (!this.isFileSystemSupported) {
                this.showCompatibilityWarning();
            }
            
            return this.isFileSystemSupported;
        } catch (error) {
            console.error('[FileStorageManager] 浏览器兼容性检查失败:', error);
            this.isFileSystemSupported = false;
            return false;
        }
    }

    /**
     * 显示浏览器兼容性警告
     */
    showCompatibilityWarning() {
        const warningMessage = `
            您的浏览器不完全支持最新的文件系统功能。
            建议使用以下浏览器的最新版本以获得最佳体验：
            • Chrome 86+
            • Edge 86+
            • Opera 72+
            
            当前将使用传统的文件下载/上传方式。
        `;
        
        // 创建警告提示（非阻塞式）
        this.showNotification(warningMessage, 'warning', 8000);
    }

    /**
     * 请求用户选择存储目录
     * @returns {Promise<boolean>} 是否成功获取目录权限
     */
    async requestStorageDirectory() {
        if (!this.isFileSystemSupported) {
            console.log('[FileStorageManager] 不支持目录选择，使用传统文件操作');
            return false;
        }

        try {
            // 显示目录选择器
            this.directoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents'
            });

            if (this.directoryHandle) {
                this.storageDirectory = this.directoryHandle.name;
                
                // 保存目录句柄到IndexedDB（用于下次访问）
                await this.saveDirectoryHandle();
                
                console.log(`[FileStorageManager] 成功获取存储目录: ${this.storageDirectory}`);
                this.showNotification('存储目录设置成功！', 'success');
                return true;
            }
            
            return false;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[FileStorageManager] 用户取消了目录选择');
            } else {
                console.error('[FileStorageManager] 目录选择失败:', error);
                this.showNotification('目录选择失败，请重试', 'error');
            }
            return false;
        }
    }

    /**
     * 保存目录句柄到IndexedDB
     */
    /**
     * 保存目录句柄到IndexedDB
     */
    async saveDirectoryHandle() {
        if (!this.directoryHandle) return;

        // 确保数据库已初始化
        if (!this.dbInitialized) {
            await this.initializeDatabase();
        }

        return new Promise((resolve, reject) => {
            try {
                // 强制升级到版本2以确保对象存储被创建
                const request = indexedDB.open('YearCircleStorage', 2);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;                    
                    if (!db.objectStoreNames.contains('directories')) {
                        db.createObjectStore('directories');
                    } else {
                    }
                };

                request.onsuccess = (event) => {
                    const db = event.target.result;
                    
                    try {
                        // 再次检查对象存储是否存在
                        if (!db.objectStoreNames.contains('directories')) {
                            console.error('[FileStorageManager] 对象存储仍不存在，无法保存目录句柄');
                            console.error('[FileStorageManager] 当前数据库版本:', db.version);
                            console.error('[FileStorageManager] 可用对象存储:', Array.from(db.objectStoreNames));
                            db.close();
                            reject(new Error('对象存储不存在'));
                            return;
                        }
                        
                        const transaction = db.transaction(['directories'], 'readwrite');
                        const store = transaction.objectStore('directories');
                        const putRequest = store.put(this.directoryHandle, 'storageDirectory');
                        
                        putRequest.onsuccess = () => {
                            db.close();
                            resolve();
                        };
                        
                        putRequest.onerror = (error) => {
                            db.close();
                            reject(error);
                        };
                        
                        transaction.onerror = (error) => {
                            db.close();
                            reject(error);
                        };
                    } catch (error) {
                        console.error('[FileStorageManager] 创建事务失败:', error);
                        db.close();
                        reject(error);
                    }
                };

                request.onerror = (event) => {
                    console.error('[FileStorageManager] 打开IndexedDB失败:', event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error('[FileStorageManager] 保存目录句柄异常:', error);
                reject(error);
            }
        });
    }

    /**
     * 从IndexedDB恢复目录句柄
     */
    async restoreDirectoryHandle() {
        
        if (!this.isFileSystemSupported) {
            return;
        }

        // 确保数据库已初始化
        if (!this.dbInitialized) {
            await this.initializeDatabase();
        }

        return new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open('YearCircleStorage', 2);
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    if (!db.objectStoreNames.contains('directories')) {
                        db.createObjectStore('directories');
                    }
                };
                
                request.onsuccess = async (event) => {
                    const db = event.target.result;
                    
                    try {
                        // 检查对象存储是否存在
                        if (!db.objectStoreNames.contains('directories')) {
                            db.close();
                            resolve();
                            return;
                        }
                        
                        const transaction = db.transaction(['directories'], 'readonly');
                        const store = transaction.objectStore('directories');
                        const getRequest = store.get('storageDirectory');
                        
                        getRequest.onsuccess = async () => {
                            if (getRequest.result) {
                                this.directoryHandle = getRequest.result;
                                
                                // 验证目录句柄是否仍然有效
                                try {
                                    await this.directoryHandle.requestPermission({ mode: 'readwrite' });
                                    this.storageDirectory = this.directoryHandle.name;
                                    console.log(`[FileStorageManager] 成功恢复存储目录: ${this.storageDirectory}`);
                                } catch (error) {
                                    console.log('[FileStorageManager] 目录权限已失效，需要重新选择');
                                    this.directoryHandle = null;
                                    this.storageDirectory = null;
                                }
                            } else {
                                console.log('[FileStorageManager] 没有找到已保存的目录句柄');
                            }
                            db.close();
                            resolve();
                        };
                        
                        getRequest.onerror = (error) => {
                            console.error('[FileStorageManager] 获取目录句柄失败:', error);
                            db.close();
                            reject(error);
                        };
                        
                        transaction.onerror = (error) => {
                            console.error('[FileStorageManager] 事务失败:', error);
                            db.close();
                            reject(error);
                        };
                    } catch (error) {
                        console.error('[FileStorageManager] 创建事务失败:', error);
                        db.close();
                        resolve(); // 即使失败也继续，不阻塞应用启动
                    }
                };
                
                request.onerror = (event) => {
                    console.error('[FileStorageManager] 打开IndexedDB失败:', event.target.error);
                    resolve(); // 即使失败也继续，不阻塞应用启动
                };
            } catch (error) {
                console.error('[FileStorageManager] 恢复目录句柄失败:', error);
                resolve(); // 即使失败也继续，不阻塞应用启动
            }
        });
    }

    /**
     * 生成文件名
     * @param {number} year - 年份
     * @param {string} startDate - 起始日期 (YYYY-MM-DD格式)
     * @returns {string} 文件名
     */
    generateFileName(year, startDate = null) {
        if (startDate) {
            // 自定义起始日期格式：年度回顾_2024_1019.json
            const dateStr = startDate.replace(/-/g, '').substring(4); // 提取MMDD
            return `年度回顾_${year}_${dateStr}.json`;
        } else {
            // 默认格式：年度回顾_2024_0101.json
            return `年度回顾_${year}_0101.json`;
        }
    }

    /**
     * 保存数据到本地文件
     * @param {number} year - 年份
     * @param {Object} data - 要保存的数据
     * @param {string} startDate - 起始日期
     * @returns {Promise<boolean>} 保存是否成功
     */
    async saveToFile(year, data, startDate = null) {
        if (!this.directoryHandle) {
            console.log('[FileStorageManager] 没有存储目录，尝试请求目录权限');
            const hasDirectory = await this.requestStorageDirectory();
            if (!hasDirectory) {
                return this.fallbackSave(year, data);
            }
        }

        try {
            const fileName = this.generateFileName(year, startDate);
            
            // 添加文件元数据
            const fileData = {
                ...data,
                year: year,
                startDate: startDate,
                lastModified: new Date().toISOString(),
                version: '1.4',
                storageType: 'file'
            };

            // 创建或获取文件句柄
            const fileHandle = await this.directoryHandle.getFileHandle(fileName, {
                create: true
            });

            // 创建可写流
            const writable = await fileHandle.createWritable();
            
            // 写入数据
            await writable.write(JSON.stringify(fileData, null, 2));
            await writable.close();

            console.log(`[FileStorageManager] 数据已保存到文件: ${fileName}`);
            return true;
        } catch (error) {
            console.error('[FileStorageManager] 文件保存失败:', error);
            
            // 如果文件保存失败，降级到localStorage
            return this.fallbackSave(year, data);
        }
    }

    /**
     * 从本地文件加载数据
     * @param {number} year - 年份
     * @param {string} startDate - 起始日期
     * @returns {Promise<Object|null>} 加载的数据
     */
    async loadFromFile(year, startDate = null) {

        if (!this.directoryHandle) {
            console.log('[FileStorageManager] 没有存储目录，使用localStorage');
            return this.fallbackLoad(year);
        }

        try {
            const fileName = this.generateFileName(year, startDate);
            console.log('[FileStorageManager] 期望的文件名:', fileName);
            
            // 获取文件句柄
            const fileHandle = await this.directoryHandle.getFileHandle(fileName);
            
            // 读取文件内容
            const file = await fileHandle.getFile();
            const text = await file.text();
            const data = JSON.parse(text);

            console.log(`[FileStorageManager] 数据已从文件加载: ${fileName}`);
            return data;
        } catch (error) {
            if (error.name === 'NotFoundError') {
                console.log(`[FileStorageManager] 文件不存在，尝试从localStorage加载`);
            } else {
                console.error('[FileStorageManager] 文件加载失败:', error);
            }
            
            // 降级到localStorage
            return this.fallbackLoad(year);
        }
    }

    /**
     * 降级保存到localStorage
     * @param {number} year - 年份
     * @param {Object} data - 数据
     * @returns {boolean} 保存是否成功
     */
    fallbackSave(year, data) {
        console.log('[FileStorageManager] 降级到localStorage保存');
        return window.storageManager.saveYearData(year, data);
    }

    /**
     * 降级从localStorage加载
     * @param {number} year - 年份
     * @returns {Object|null} 加载的数据
     */
    fallbackLoad(year) {
        console.log('[FileStorageManager] 降级到localStorage加载');
        
        // 直接从localStorage加载，避免循环调用
        try {
            const storageKey = 'year_circle_data';
            const key = `${storageKey}_${year}`;
            const data = localStorage.getItem(key);
            
            if (data) {
                const parsedData = JSON.parse(data);
                console.log(`[FileStorageManager] 从localStorage加载${year}年数据成功`);
                return parsedData;
            }
            
            console.log(`[FileStorageManager] localStorage中没有${year}年的数据`);
            return null;
        } catch (error) {
            console.error(`[FileStorageManager] 从localStorage加载${year}年数据失败:`, error);
            return null;
        }
    }

    /**
     * 获取存储状态信息
     * @returns {Object} 存储状态
     */
    getStorageStatus() {
        return {
            fileSystemSupported: this.isFileSystemSupported,
            hasDirectoryAccess: !!this.directoryHandle,
            storageDirectory: this.storageDirectory,
            fallbackEnabled: this.fallbackToLocalStorage
        };
    }

    /**
     * 检查是否支持文件系统API
     * @returns {boolean} 是否支持File System Access API
     */
    isSupported() {
        return this.isFileSystemSupported;
    }

    /**
     * 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, error, warning, info)
     * @param {number} duration - 显示时长（毫秒）
     */
    showNotification(message, type = 'info', duration = 3000) {
        // 这里可以集成到应用的通知系统
        // 临时使用console输出
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 如果是错误或警告，也显示alert
        if (type === 'error' || type === 'warning') {
            setTimeout(() => alert(message), 100);
        }
    }

    /**
     * 传统文件导出（兼容不支持File System Access API的浏览器）
     * @param {number} year - 年份
     * @param {Object} data - 数据
     * @param {string} startDate - 起始日期
     */
    exportAsDownload(year, data, startDate = null) {
        try {
            const fileName = this.generateFileName(year, startDate);
            
            const fileData = {
                ...data,
                year: year,
                startDate: startDate,
                lastModified: new Date().toISOString(),
                version: '1.4',
                storageType: 'download'
            };

            const blob = new Blob([JSON.stringify(fileData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log(`[FileStorageManager] 文件已导出下载: ${fileName}`);
            this.showNotification('文件导出成功！', 'success');
        } catch (error) {
            console.error('[FileStorageManager] 文件导出失败:', error);
            this.showNotification('文件导出失败', 'error');
        }
    }

    /**
     * 传统文件导入（兼容不支持File System Access API的浏览器）
     * @returns {Promise<Object|null>} 导入的数据
     */
    async importFromUpload() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }

                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    console.log('[FileStorageManager] 文件导入成功');
                    this.showNotification('文件导入成功！', 'success');
                    resolve(data);
                } catch (error) {
                    console.error('[FileStorageManager] 文件导入失败:', error);
                    this.showNotification('文件格式错误，导入失败', 'error');
                    resolve(null);
                }
            };
            
            input.click();
        });
    }
}

// 暴露 FileStorageManager 类到全局
window.FileStorageManager = FileStorageManager;

// 创建全局文件存储管理器实例
window.fileStorageManager = new FileStorageManager();