// Dufs 文件管理器 JavaScript 代码
// 全局变量
let currentPath = '/';
let authToken = '';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - starting initialization...');
    console.log('Current URL:', window.location.href);
    console.log('Document ready state:', document.readyState);
    
    try {
        setupEventListeners();
        refreshFileList();
        checkHealth();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// 设置事件监听器
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const fileInput = document.getElementById('fileInput');
    const searchInput = document.getElementById('searchInput');
    const dropOverlay = document.getElementById('dropOverlay');

    console.log('Elements found:', { 
        fileInput: !!fileInput, 
        searchInput: !!searchInput, 
        dropOverlay: !!dropOverlay 
    });

    // 检查元素是否存在
    if (!fileInput) {
        console.error('fileInput element not found - check HTML for element with id="fileInput"');
        return;
    }
    if (!searchInput) {
        console.error('searchInput element not found - check HTML for element with id="searchInput"');
        return;
    }
    if (!dropOverlay) {
        console.error('dropOverlay element not found - check HTML for element with id="dropOverlay"');
        return;
    }    // 全页面拖拽上传
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        // 只有外部文件拖拽才显示上传覆盖层
        if (dragCounter === 1 && !draggedItem && e.dataTransfer.types.includes('Files')) {
            document.body.classList.add('dragging');
            dropOverlay.style.display = 'flex';
        }
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0 && !draggedItem) {
            document.body.classList.remove('dragging');
            dropOverlay.style.display = 'none';
        }
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        document.body.classList.remove('dragging');
        dropOverlay.style.display = 'none';
        
        // 只处理外部文件拖拽
        if (!draggedItem) {
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                uploadFiles(files);
            }
        }
    });

    // 添加拖拽结束事件
    document.addEventListener('dragend', (e) => {
        // 重置拖拽状态
        if (e.target.classList && e.target.classList.contains('file-item')) {
            e.target.style.opacity = '1';
        }
        draggedItem = null;
    });

    // 文件选择
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        uploadFiles(files);
        e.target.value = ''; // 清空文件选择，允许重复选择同一文件
    });    // 搜索回车
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchFiles();
        }
    });
    
    // 搜索框输入事件 - 当清空搜索框时自动返回文件列表
    searchInput.addEventListener('input', (e) => {
        if (e.target.value.trim() === '') {
            clearSearchResults();
        }
    });

    // 面包屑拖拽离开事件
    document.addEventListener('dragleave', (e) => {
        if (e.target.classList.contains('breadcrumb-item')) {
            e.target.classList.remove('breadcrumb-drag-over');
        }
    });
}

// 显示状态消息
function showStatus(message, type = 'success', duration = 3000) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    
    // 如果是哈希消息，添加复制功能
    if (type === 'hash') {
        const hashValue = message.split('SHA256哈希值: ')[1];
        if (hashValue) {
            statusDiv.innerHTML = `
                <div class="status ${type}">
                    ${message}
                    <button class="copy-btn" onclick="copyToClipboard('${hashValue}')">复制哈希值</button>
                </div>
            `;
            duration = 10000; // 哈希值显示10秒
        }
    }
    
    setTimeout(() => {
        statusDiv.innerHTML = '';
    }, duration);
}

// 导航到指定路径
function navigateTo(path) {
    // 清除搜索状态
    clearSearchResults();
    
    currentPath = path;
    updateBreadcrumb();
    refreshFileList();
}

// 更新面包屑导航
function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    const pathToUse = path || currentPath;
    const parts = pathToUse.split('/').filter(p => p);
    let html = '<a href="#" onclick="navigateTo(\'/\')" class="breadcrumb-item" data-path="/" ondragover="handleBreadcrumbDragOver(event, \'/\')" ondrop="handleBreadcrumbDrop(event, \'/\')">🏠</a>';
    
    let fullPath = '';
    parts.forEach((part, index) => {
        fullPath += '/' + part;
        html += ` / <a href="#" onclick="navigateTo('${fullPath}')" class="breadcrumb-item" data-path="${fullPath}" ondragover="handleBreadcrumbDragOver(event, '${fullPath}')" ondrop="handleBreadcrumbDrop(event, '${fullPath}')">${part}</a>`;
    });
    
    breadcrumb.innerHTML = html;
}

// 刷新文件列表
async function refreshFileList() {
    // 清除搜索状态
    clearSearchResults();
    
    try {
        const response = await fetch(`${currentPath}?json`);
        
        if (!response.ok) throw new Error('获取文件列表失败');
        
        const data = await response.json();
        const fileList = data && data.paths ? data.paths : [];
        
        displayFileList(fileList);
        updateBreadcrumb(data.href || currentPath);
    } catch (error) {
        showStatus('刷新文件列表失败: ' + error.message, 'error');
    }
}

// 显示文件列表
function displayFileList(files) {
    const fileList = document.getElementById('fileList');
    
    if (!Array.isArray(files)) {
        fileList.innerHTML = '<p>📭 文件列表数据格式错误</p>';
        return;
    }
    
    if (files.length === 0) {
        fileList.innerHTML = '<p>📭 此文件夹为空</p>';
        return;
    }

    let html = '';
    
    files.forEach(file => {
        const isDir = file.path_type === 'Dir';
        const icon = isDir ? '📁' : getFileIcon(file.name);
        const size = isDir ? '' : formatFileSize(file.size);
        const filePath = currentPath + (currentPath.endsWith('/') ? '' : '/') + file.name;        html += `
            <div class="file-item" 
                 draggable="true" 
                 data-filename="${file.name}"
                 data-is-dir="${isDir}"
                 data-file-path="${filePath}"
                 onclick="handleFileClick('${file.name}', ${isDir})"
                 oncontextmenu="handleRightClick(event, '${file.name}', ${isDir})"
                 ondragstart="handleDragStart(event, '${file.name}')"
                 ondragover="handleDragOver(event, ${isDir})"
                 ondragleave="handleDragLeave(event, ${isDir})"
                 ondrop="handleDrop(event, '${file.name}', ${isDir})">
                <div class="file-info">
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${file.name}</span>
                    ${size ? `<span class="file-size">${size}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    fileList.innerHTML = html;
}

// 获取文件图标
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
        'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
        'mp3': '🎵', 'wav': '🎵', 'flac': '🎵',
        'pdf': '📕', 'doc': '📄', 'docx': '📄',
        'txt': '📝', 'md': '📝',
        'zip': '📦', 'rar': '📦', '7z': '📦',
        'js': '💾', 'html': '💾', 'css': '💾', 'py': '💾'
    };
    return iconMap[ext] || '📄';
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 上传文件
async function uploadFiles(files) {
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const uploadStatus = document.getElementById('uploadStatus');
    
    progressDiv.style.display = 'block';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = ((i + 1) / files.length) * 100;
        progressBar.style.width = progress + '%';
        uploadStatus.textContent = `上传中: ${file.name} (${i + 1}/${files.length})`;
        
        try {
            const uploadPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + file.name;
            const response = await fetch(uploadPath, {
                method: 'PUT',
                body: file
            });
            
            if (!response.ok) throw new Error(`上传失败: ${response.statusText}`);
        } catch (error) {
            showStatus(`上传 ${file.name} 失败: ${error.message}`, 'error');
        }
    }
    
    progressDiv.style.display = 'none';
    showStatus(`成功上传 ${files.length} 个文件`);
    refreshFileList();
}

// 下载文件
function downloadFile(filename) {
    const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + filename;
    window.open(url, '_blank');
}

// 复制到剪贴板
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showStatus('哈希值已复制到剪贴板', 'success', 2000);
    } catch (error) {
        // 降级方案：使用旧的方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus('哈希值已复制到剪贴板', 'success', 2000);
    }
}

// 获取文件哈希
async function getFileHash(filename) {
    try {
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + filename + '?hash';
        console.log('Fetching hash from URL:', url);
        
        const response = await fetch(url);
        console.log('Hash response status:', response.status);
        
        if (!response.ok) throw new Error('获取哈希失败');
        
        const hash = await response.text();
        console.log('Hash value received:', hash);
        
        showStatus(`文件 ${filename} 的SHA256哈希值: ${hash}`, 'hash', 15000);
        console.log('Status message set');
    } catch (error) {
        console.error('Hash fetch error:', error);
        showStatus('获取文件哈希失败: ' + error.message, 'error');
    }
}

// 删除文件/文件夹
async function deleteFile(filename) {
    if (!confirm(`确定要删除 "${filename}" 吗？`)) return;
    
    try {
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + filename;
        const response = await fetch(url, { method: 'DELETE' });
        
        if (!response.ok) throw new Error('删除失败');
        
        showStatus(`成功删除 ${filename}`);
        refreshFileList();
    } catch (error) {
        showStatus('删除失败: ' + error.message, 'error');
    }
}

// 移动文件
async function moveFile(filename) {
    const newPath = prompt(`请输入 "${filename}" 的新路径:`, currentPath + '/' + filename);
    if (!newPath || newPath === currentPath + '/' + filename) return;
    
    try {
        const oldUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + filename;
        const response = await fetch(oldUrl, {
            method: 'MOVE',
            headers: {
                'Destination': window.location.origin + newPath
            }
        });
        
        if (!response.ok) throw new Error('移动失败');
        
        showStatus(`成功移动 ${filename} 到 ${newPath}`);
        refreshFileList();
    } catch (error) {
        showStatus('移动失败: ' + error.message, 'error');
    }
}

// 创建文件夹
async function createFolder() {
    const folderName = prompt('请输入文件夹名称:');
    if (!folderName) return;
    
    try {
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + folderName;
        const response = await fetch(url, { method: 'MKCOL' });
        
        if (!response.ok) throw new Error('创建文件夹失败');
        
        showStatus(`成功创建文件夹 ${folderName}`);
        refreshFileList();
    } catch (error) {
        showStatus('创建文件夹失败: ' + error.message, 'error');
    }
}

// 搜索文件
async function searchFiles() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        // 如果搜索框为空，清空搜索结果并显示文件列表
        clearSearchResults();
        return;
    }
    
    try {
        const response = await fetch(`${currentPath}?q=${encodeURIComponent(query)}&json`);
        if (!response.ok) throw new Error('搜索失败');
        
        const results = await response.json();
        displaySearchResults(results);
        
        // 隐藏主文件列表
        const fileListSection = document.querySelector('.file-list-section');
        if (fileListSection) {
            fileListSection.style.display = 'none';
        }
    } catch (error) {
        showStatus('搜索失败: ' + error.message, 'error');
    }
}

// 显示搜索结果
function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    
    if (!searchResults) {
        console.warn('searchResults element not found');
        return;
    }
    
    let searchArray = [];
    
    if (results && results.paths) {
        searchArray = Array.isArray(results.paths) ? results.paths : [];
    } else if (Array.isArray(results)) {
        searchArray = results;
    }
    
    if (searchArray.length === 0) {
        searchResults.innerHTML = `
            <div class="search-header">
                <h4>🔍 未找到匹配的文件</h4>
                <button class="btn" onclick="clearSearchResults()">返回文件列表</button>
            </div>
        `;
        searchResults.style.display = 'block';
        return;
    }
    
    let html = `
        <div class="search-header">
            <h4>搜索结果 (${searchArray.length} 个文件):</h4>
            <button class="btn" onclick="clearSearchResults()">返回文件列表</button>
        </div>
    `;
    
    searchArray.forEach(file => {
        const isDir = file.path_type === 'Dir';
        const icon = isDir ? '📁' : getFileIcon(file.name);
        const filePath = file.path || (currentPath + '/' + file.name);
        html += `
            <div class="file-item" 
                 onclick="handleFileClick('${file.name}', ${isDir})"
                 oncontextmenu="handleRightClick(event, '${file.name}', ${isDir})"
                 data-filename="${file.name}"
                 data-is-dir="${isDir}"
                 data-file-path="${filePath}">
                <div class="file-info">
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${file.name}</span>
                    ${file.size ? `<span class="file-size">${formatFileSize(file.size)}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    searchResults.innerHTML = html;
    searchResults.style.display = 'block';
}

// 清空搜索结果
function clearSearchResults() {
    const searchResults = document.getElementById('searchResults');
    const searchInput = document.getElementById('searchInput');
    const fileListSection = document.querySelector('.file-list-section');
    
    // 隐藏搜索结果
    if (searchResults) {
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
    }
    
    // 清空搜索框
    if (searchInput) {
        searchInput.value = '';
    }
    
    // 显示文件列表
    if (fileListSection) {
        fileListSection.style.display = 'flex';
    }
}

// 下载当前文件夹为ZIP
function downloadAsZip() {
    const url = currentPath + '?zip';
    window.open(url, '_blank');
    showStatus('正在下载ZIP文件...');
}

// 健康检查
async function checkHealth() {
    const healthButton = document.querySelector('button[onclick="checkHealth()"]');
    
    if (!healthButton) {
        console.warn('健康检查按钮未找到');
        return;
    }
    
    try {
        const response = await fetch('/__dufs__/health');
        
        if (response.ok) {
            healthButton.innerHTML = '💚'; // 绿心
            healthButton.setAttribute('data-tooltip', '服务正常');
        } else {
            healthButton.innerHTML = '❤️'; // 红心
            healthButton.setAttribute('data-tooltip', '服务异常');
        }
    } catch (error) {
        healthButton.innerHTML = '❤️'; // 红心
        healthButton.setAttribute('data-tooltip', '无法连接到服务');
    }
}

// 处理文件/文件夹点击
function handleFileClick(filename, isDir) {
    if (isDir) {
        // 文件夹：导航进入
        navigateTo(currentPath + (currentPath.endsWith('/') ? '' : '/') + filename);
    } else {
        // 文件：下载
        downloadFile(filename);
    }
}

// 处理右键点击
function handleRightClick(event, filename, isDir) {
    event.preventDefault();
    
    // 创建右键菜单
    const existingMenu = document.getElementById('contextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const contextMenu = document.createElement('div');
    contextMenu.id = 'contextMenu';
    contextMenu.className = 'context-menu';
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    contextMenu.style.zIndex = '1000';
    
    let menuItems = '';
    
    if (!isDir) {
        // 文件的右键菜单
        menuItems = `
            <div class="context-menu-item" onclick="downloadFile('${filename}'); removeContextMenu();">
                📥 下载
            </div>
            <div class="context-menu-item" onclick="getFileHash('${filename}'); removeContextMenu();">
                🔍 获取哈希
            </div>
            <div class="context-menu-separator"></div>
        `;
    }
    
    // 通用菜单项
    menuItems += `
        <div class="context-menu-item" onclick="renameFile('${filename}'); removeContextMenu();">
            ✏️ 重命名
        </div>
        <div class="context-menu-item" onclick="getFileInfo('${filename}'); removeContextMenu();">
            ℹ️ 属性
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item context-menu-danger" onclick="deleteFile('${filename}'); removeContextMenu();">
            🗑️ 删除
        </div>
    `;
    
    contextMenu.innerHTML = menuItems;
    
    document.body.appendChild(contextMenu);
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', removeContextMenu, { once: true });
    }, 10);
}

// 移除右键菜单
function removeContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.remove();
    }
}

// 拖拽开始
let draggedItem = null;
function handleDragStart(event, filename) {
    draggedItem = {
        filename: filename,
        sourcePath: currentPath
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', filename);
    
    // 添加拖拽样式
    event.target.style.opacity = '0.5';
}

// 拖拽悬停
function handleDragOver(event, isDir) {
    if (!isDir || !draggedItem) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    // 添加悬停样式
    event.currentTarget.classList.add('drag-over');
}

// 拖拽离开
function handleDragLeave(event, isDir) {
    if (!isDir) return;
    
    // 移除悬停样式
    event.currentTarget.classList.remove('drag-over');
}

// 处理拖拽放置
async function handleDrop(event, targetFolderName, isTargetDir) {
    event.preventDefault();
    
    // 移除悬停样式
    event.currentTarget.classList.remove('drag-over');
    
    if (!isTargetDir || !draggedItem) return;
    
    const sourceFile = draggedItem.filename;
    const sourcePath = draggedItem.sourcePath;
    const targetPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + targetFolderName;
    
    // 防止移动到自己
    if (sourceFile === targetFolderName) {
        showStatus('不能将文件夹移动到自己内部', 'error');
        return;
    }
    
    // 重置拖拽状态
    draggedItem = null;
    
    // 确认移动
    if (!confirm(`确定要将 "${sourceFile}" 移动到 "${targetFolderName}" 文件夹吗？`)) {
        return;
    }
    
    try {
        const oldUrl = sourcePath + (sourcePath.endsWith('/') ? '' : '/') + sourceFile;
        const newUrl = targetPath + '/' + sourceFile;
        
        const response = await fetch(oldUrl, {
            method: 'MOVE',
            headers: {
                'Destination': window.location.origin + newUrl
            }
        });
        
        if (!response.ok) throw new Error('移动失败');
        
        showStatus(`成功将 ${sourceFile} 移动到 ${targetFolderName}`);
        refreshFileList();
    } catch (error) {
        showStatus('移动失败: ' + error.message, 'error');
    }
}

// 重命名文件
async function renameFile(oldName) {
    const newName = prompt(`请输入新的文件名:`, oldName);
    if (!newName || newName === oldName) return;
    
    try {
        const oldUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + oldName;
        const newUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + newName;
        
        const response = await fetch(oldUrl, {
            method: 'MOVE',
            headers: {
                'Destination': window.location.origin + newUrl
            }
        });
        
        if (!response.ok) throw new Error('重命名失败');
        
        showStatus(`成功将 ${oldName} 重命名为 ${newName}`);
        refreshFileList();
    } catch (error) {
        showStatus('重命名失败: ' + error.message, 'error');
    }
}

// 获取文件信息
async function getFileInfo(filename) {
    try {
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + filename;
        const response = await fetch(url, { method: 'HEAD' });
        
        if (!response.ok) throw new Error('获取文件信息失败');
        
        const size = response.headers.get('content-length');
        const lastModified = response.headers.get('last-modified');
        const contentType = response.headers.get('content-type');
        
        let info = `文件名: ${filename}\n`;
        if (size) info += `大小: ${formatFileSize(parseInt(size))}\n`;
        if (lastModified) info += `修改时间: ${new Date(lastModified).toLocaleString()}\n`;
        if (contentType) info += `类型: ${contentType}`;
        
        alert(info);
    } catch (error) {
        showStatus('获取文件信息失败: ' + error.message, 'error');
    }
}

// 处理面包屑拖拽悬停
function handleBreadcrumbDragOver(event, targetPath) {
    if (!draggedItem) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    // 添加悬停样式
    event.currentTarget.classList.add('breadcrumb-drag-over');
}

// 处理面包屑拖拽放置
async function handleBreadcrumbDrop(event, targetPath) {
    event.preventDefault();
    
    // 移除悬停样式
    event.currentTarget.classList.remove('breadcrumb-drag-over');
    
    if (!draggedItem) return;
    
    const sourceFile = draggedItem.filename;
    const sourcePath = draggedItem.sourcePath;
    
    // 防止移动到相同位置
    if (sourcePath === targetPath) {
        showStatus('文件已在该位置', 'error');
        return;
    }
    
    // 重置拖拽状态
    draggedItem = null;
    
    // 确认移动
    if (!confirm(`确定要将 "${sourceFile}" 移动到 "${targetPath}" 吗？`)) {
        return;
    }
    
    try {
        const oldUrl = sourcePath + (sourcePath.endsWith('/') ? '' : '/') + sourceFile;
        const newUrl = targetPath + (targetPath.endsWith('/') ? '' : '/') + sourceFile;
        
        const response = await fetch(oldUrl, {
            method: 'MOVE',
            headers: {
                'Destination': window.location.origin + newUrl
            }
        });
        
        if (!response.ok) throw new Error('移动失败');
        
        showStatus(`成功将 ${sourceFile} 移动到 ${targetPath}`);
        refreshFileList();
    } catch (error) {
        showStatus('移动失败: ' + error.message, 'error');
    }
}
