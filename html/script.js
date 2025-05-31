// Dufs 文件管理器 JavaScript 代码
// 全局变量
let currentPath = '/';
let authToken = '';
let isLoggedIn = false;

// 多选模式相关变量
let isMultiSelectMode = false;
let selectedFiles = new Set();

// 权限检查函数
function requireAuth(operation = '此操作') {
    if (!isLoggedIn) {
        showStatus(`${operation}需要登录权限，请先登录`, 'error');
        return false;
    }
    return true;
}

// 显示登录模态框
function showLoginModal() {
    if (isLoggedIn) {
        logout();
        return;
    }
    
    const modal = document.getElementById('loginModal');
    modal.style.display = 'flex';
    
    // 焦点到用户名输入框
    setTimeout(() => {
        document.getElementById('username').focus();
    }, 100);
}

// 关闭登录模态框
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'none';
    
    // 清空输入框
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// 处理登录输入框的回车键事件
function handleLoginKeyPress(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        login();
    }
}

// 登录
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showStatus('请输入用户名和密码', 'error');
        return;
    }
    
    try {
        // 创建基本认证头
        const credentials = btoa(`${username}:${password}`);
        const testAuthToken = `Basic ${credentials}`;
        
        // 测试认证 - 不让浏览器弹出认证对话框
        const response = await fetch(currentPath + '?json', {
            headers: {
                'Authorization': testAuthToken
            },
            // 防止浏览器弹出认证对话框
            credentials: 'omit'
        });
        
        if (response.ok) {
            authToken = testAuthToken;
            isLoggedIn = true;
            updateLoginButton();
            closeLoginModal();
            showStatus(`欢迎回来，${username}！`, 'success');
            refreshFileList();
        } else if (response.status === 401) {
            showStatus('登录失败：用户名或密码错误', 'error');
        } else {
            showStatus(`登录失败：服务器错误 (${response.status})`, 'error');
        }
    } catch (error) {
        showStatus('登录失败：网络连接错误', 'error');
        console.error('Login error:', error);
    }
}

// 登出
function logout() {
    authToken = '';
    isLoggedIn = false;
    updateLoginButton();
    showStatus('已退出登录', 'success');
    refreshFileList();
}

// 更新登录按钮状态
function updateLoginButton() {
    const loginBtn = document.getElementById('loginBtn');
    if (isLoggedIn) {
        loginBtn.innerHTML = '👤✓';
        loginBtn.setAttribute('data-tooltip', '点击退出登录');
        loginBtn.style.background = '#28a745';
    } else {
        loginBtn.innerHTML = '👤';
        loginBtn.setAttribute('data-tooltip', '用户登录');
        loginBtn.style.background = '#4CAF50';
    }
}

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
    });    // 添加拖拽结束事件
    document.addEventListener('dragend', (e) => {
        // 重置拖拽状态
        if (e.target.classList && e.target.classList.contains('file-item')) {
            e.target.style.opacity = '1';
        }
        resetDragState();
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
    });    // 面包屑拖拽离开事件
    document.addEventListener('dragleave', (e) => {
        if (e.target.classList.contains('breadcrumb-item')) {
            e.target.classList.remove('breadcrumb-drag-over');
        }
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        // 如果用户正在输入，不处理快捷键
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Ctrl/Cmd + U: 上传文件
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            document.getElementById('fileInput').click();
            showStatus('打开文件上传对话框', 'success', 2000);
        }
        
        // F5 或 Ctrl/Cmd + R: 刷新文件列表
        else if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
            e.preventDefault();
            refreshFileList();
            showStatus('已刷新文件列表', 'success', 2000);
        }
        
        // Ctrl/Cmd + F: 聚焦搜索框
        else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            searchInput.focus();
            searchInput.select();
            showStatus('聚焦到搜索框', 'success', 2000);
        }          // Escape: 关闭所有模态框和菜单
        else if (e.key === 'Escape') {
            // 关闭登录模态框
            const loginModal = document.getElementById('loginModal');
            if (loginModal && loginModal.style.display !== 'none') {
                closeLoginModal();
            }
            
            // 关闭路径输入模态框
            const pathInputModal = document.getElementById('pathInputModal');
            if (pathInputModal) {
                closePathInputModal();
            }
            
            // 关闭右键菜单
            removeContextMenu();
            
            // 关闭图片预览
            closeImagePreview();
            
            // 退出多选模式
            if (isMultiSelectMode) {
                toggleMultiSelect();
                return; // 退出多选模式后不执行其他操作
            }
            
            // 清空搜索
            const searchInput = document.getElementById('searchInput');
            if (searchInput && searchInput.value.trim() !== '') {
                clearSearchResults();
                showStatus('清空搜索结果', 'success', 2000);
            }
        }
        
        // 返回上一级 (Backspace 或 Alt + ←)
        else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
            e.preventDefault();
            if (currentPath !== '/') {
                const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
                navigateTo(parentPath);
                showStatus('返回上一级目录', 'success', 2000);
            }
        }
        
        // Ctrl/Cmd + Shift + N: 新建文件夹
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
            e.preventDefault();
            createFolder();
        }
          // Ctrl/Cmd + D: 下载当前文件夹为ZIP
        else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            downloadAsZip();
        }
        
        // Ctrl/Cmd + Shift + T: 新建文本文件
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            createNewTextFile();
        }
    });
}

// ==================== 多选模式相关功能 ====================

// 切换多选模式
function toggleMultiSelect() {
    isMultiSelectMode = !isMultiSelectMode;
    selectedFiles.clear();
    
    const multiSelectBtn = document.getElementById('multiSelectBtn');
    
    if (isMultiSelectMode) {
        multiSelectBtn.style.backgroundColor = '#4CAF50';
        multiSelectBtn.style.color = 'white';
        multiSelectBtn.innerHTML = '✅';
        multiSelectBtn.setAttribute('data-tooltip', '退出多选模式');
        showStatus('已进入多选模式，点击文件进行选择', 'success', 3000);
        
        // 显示批量操作按钮
        showBatchOperationButtons();
    } else {
        multiSelectBtn.style.backgroundColor = '';
        multiSelectBtn.style.color = '';
        multiSelectBtn.innerHTML = '☑️';
        multiSelectBtn.setAttribute('data-tooltip', '多项选择');
        showStatus('已退出多选模式', 'success', 2000);
        
        // 隐藏批量操作按钮
        hideBatchOperationButtons();
    }
    
    // 重新渲染文件列表以显示/隐藏复选框
    refreshFileList();
}

// 显示批量操作按钮
function showBatchOperationButtons() {
    let batchButtons = document.getElementById('batchOperationButtons');
    if (!batchButtons) {
        batchButtons = document.createElement('div');
        batchButtons.id = 'batchOperationButtons';
        batchButtons.className = 'batch-operation-buttons';
        batchButtons.innerHTML = `
            <div class="batch-info">
                <span id="selectedCount">已选择 0 个文件</span>
                <button class="btn btn-secondary" onclick="selectAllFiles()">全选</button>
                <button class="btn btn-secondary" onclick="clearSelection()">清除选择</button>
            </div>
            <div class="batch-actions">
                <button class="btn btn-danger" onclick="deleteSelectedFiles()" id="batchDeleteBtn" disabled>
                    🗑️ 删除选中
                </button>
                <button class="btn btn-primary" onclick="downloadSelectedFiles()" id="batchDownloadBtn" disabled>
                    📥 下载选中
                </button>
                <button class="btn btn-warning" onclick="moveSelectedFiles()" id="batchMoveBtn" disabled>
                    📁 移动选中
                </button>
            </div>
        `;
        
        // 插入到文件列表上方
        const fileListSection = document.querySelector('.file-list-section');
        fileListSection.parentNode.insertBefore(batchButtons, fileListSection);
    }
    batchButtons.style.display = 'block';
}

// 隐藏批量操作按钮
function hideBatchOperationButtons() {
    const batchButtons = document.getElementById('batchOperationButtons');
    if (batchButtons) {
        batchButtons.style.display = 'none';
    }
}

// 处理文件选择
function handleFileSelection(filename, isDir) {
    if (!isMultiSelectMode) {
        // 非多选模式，执行原来的点击逻辑
        handleFileClick(filename, isDir);
        return;
    }
    
    // 多选模式下的选择逻辑
    const fileKey = filename;
    const fileItem = document.querySelector(`[data-filename="${filename}"]`);
    const checkbox = fileItem.querySelector('.file-checkbox');
    
    if (selectedFiles.has(fileKey)) {
        selectedFiles.delete(fileKey);
        checkbox.checked = false;
        fileItem.classList.remove('selected');
    } else {
        selectedFiles.add(fileKey);
        checkbox.checked = true;
        fileItem.classList.add('selected');
    }
    
    updateSelectionUI();
}

// 更新选择状态的UI
function updateSelectionUI() {
    const selectedCount = selectedFiles.size;
    const selectedCountElement = document.getElementById('selectedCount');
    
    if (selectedCountElement) {
        selectedCountElement.textContent = `已选择 ${selectedCount} 个文件`;
    }
    
    // 更新批量操作按钮状态
    const hasSelection = selectedCount > 0;
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const batchDownloadBtn = document.getElementById('batchDownloadBtn');
    const batchMoveBtn = document.getElementById('batchMoveBtn');
    
    if (batchDeleteBtn) batchDeleteBtn.disabled = !hasSelection;
    if (batchDownloadBtn) batchDownloadBtn.disabled = !hasSelection;
    if (batchMoveBtn) batchMoveBtn.disabled = !hasSelection;
}

// 全选文件
function selectAllFiles() {
    if (!isMultiSelectMode) return;
    
    const fileItems = document.querySelectorAll('.file-item');
    selectedFiles.clear();
    
    fileItems.forEach(item => {
        const filename = item.getAttribute('data-filename');
        const checkbox = item.querySelector('.file-checkbox');
        
        if (filename && checkbox) {
            selectedFiles.add(filename);
            checkbox.checked = true;
            item.classList.add('selected');
        }
    });
    
    updateSelectionUI();
    showStatus(`已选择全部 ${selectedFiles.size} 个文件`, 'success');
}

// 清除选择
function clearSelection() {
    if (!isMultiSelectMode) return;
    
    selectedFiles.clear();
    
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const checkbox = item.querySelector('.file-checkbox');
        if (checkbox) {
            checkbox.checked = false;
            item.classList.remove('selected');
        }
    });
    
    updateSelectionUI();
    showStatus('已清除所有选择', 'success');
}

// 批量删除选中文件
async function deleteSelectedFiles() {
    if (!isMultiSelectMode || selectedFiles.size === 0) return;
    
    if (!requireAuth('批量删除文件')) {
        return;
    }
    
    const fileNames = Array.from(selectedFiles);
    let successCount = 0;
    let failCount = 0;
    
    for (const filename of fileNames) {
        try {
            const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
            const response = await fetch(url, { 
                method: 'DELETE',
                headers: {
                    'Authorization': authToken
                },
                credentials: 'omit'
            });
            
            if (response.status === 401) {
                showStatus('权限不足，请重新登录', 'error');
                return;
            }
            
            if (response.ok) {
                successCount++;
                selectedFiles.delete(filename);
            } else {
                failCount++;
                console.error(`删除 ${filename} 失败:`, response.statusText);
            }
        } catch (error) {
            failCount++;
            console.error(`删除 ${filename} 失败:`, error);
        }
    }
    
    if (successCount > 0) {
        showStatus(`成功删除 ${successCount} 个文件${failCount > 0 ? `，失败 ${failCount} 个` : ''}`, 
                  failCount > 0 ? 'warning' : 'success', 4000);
        refreshFileList();
    } else if (failCount > 0) {
        showStatus(`删除失败，共 ${failCount} 个文件删除失败`, 'error');
    }
    
    updateSelectionUI();
}

// 批量下载选中文件
function downloadSelectedFiles() {
    if (!isMultiSelectMode || selectedFiles.size === 0) return;
    
    const fileNames = Array.from(selectedFiles);
    
    if (fileNames.length === 1) {
        // 单个文件直接下载
        downloadFile(fileNames[0]);
    } else {
        // 多个文件，提示用户下载选项
        const confirmed = confirm(`要下载选中的 ${fileNames.length} 个文件吗？\n\n将会逐个下载以下文件：\n${fileNames.join('\n')}\n\n建议：如果文件较多，可以考虑使用"下载为ZIP"功能。`);
        
        if (confirmed) {
            // 逐个下载文件
            fileNames.forEach((filename, index) => {
                setTimeout(() => {
                    downloadFile(filename);
                }, index * 500); // 延迟500ms避免浏览器阻止多个下载
            });
            
            showStatus(`开始下载 ${fileNames.length} 个文件...`, 'success', 3000);
        }
    }
}

// 批量移动选中文件
async function moveSelectedFiles() {
    if (!isMultiSelectMode || selectedFiles.size === 0) return;
    
    const fileNames = Array.from(selectedFiles);
    showPathInputModal(fileNames);
}

// 显示路径输入模态框
function showPathInputModal(fileNames) {
    // 创建模态框HTML
    const modalHtml = `
        <div id="pathInputModal" class="modal" style="display: flex;">
            <div class="modal-content path-input-modal">
                <div class="modal-header">
                    <h3>📁 移动文件</h3>
                    <button class="close-btn" onclick="closePathInputModal()">✕</button>
                </div>
                <div class="modal-body">
                    <p>将移动以下 ${fileNames.length} 个文件：</p>
                    <div class="file-list-preview">
                        ${fileNames.map(name => `<div class="file-preview-item">📄 ${name}</div>`).join('')}
                    </div>
                    <div class="input-group">
                        <label for="targetPath">目标路径:</label>
                        <input type="text" id="targetPath" placeholder="请输入目标路径" value="${currentPath}/" onkeypress="handlePathInputKeyPress(event, ${JSON.stringify(fileNames).replace(/"/g, '&quot;')})">
                    </div>
                    <div class="path-suggestions">
                        <button class="path-suggestion-btn" onclick="setTargetPath('/')">根目录 (/)</button>
                        <button class="path-suggestion-btn" onclick="setTargetPath('${currentPath}/')">当前目录</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closePathInputModal()">取消</button>
                    <button class="btn btn-primary" onclick="executeMoveFiles(${JSON.stringify(fileNames).replace(/"/g, '&quot;')})">移动</button>
                </div>
            </div>
        </div>
    `;
    
    // 移除已存在的模态框
    const existingModal = document.getElementById('pathInputModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 焦点到输入框
    setTimeout(() => {
        document.getElementById('targetPath').focus();
        document.getElementById('targetPath').select();
    }, 100);
}

// 关闭路径输入模态框
function closePathInputModal() {
    const modal = document.getElementById('pathInputModal');
    if (modal) {
        modal.remove();
    }
}

// 设置目标路径
function setTargetPath(path) {
    const input = document.getElementById('targetPath');
    if (input) {
        input.value = path;
        input.focus();
    }
}

// 处理路径输入的回车键事件
function handlePathInputKeyPress(event, fileNames) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        executeMoveFiles(fileNames);
    }
}

// 执行文件移动
async function executeMoveFiles(fileNames) {
    const targetPath = document.getElementById('targetPath').value.trim();
    
    if (!targetPath || targetPath === currentPath + '/') {
        showStatus('请输入有效的目标路径', 'error');
        return;
    }
    
    if (!requireAuth('批量移动文件')) {
        return;
    }
    
    // 关闭模态框
    closePathInputModal();
    
    let successCount = 0;
    let failCount = 0;
    
    for (const filename of fileNames) {
        try {
            const oldUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
            const newUrl = targetPath + (targetPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
            
            const response = await fetch(oldUrl, {
                method: 'MOVE',
                headers: {
                    'Authorization': authToken,
                    'Destination': window.location.origin + newUrl
                },
                credentials: 'omit'
            });
            
            if (response.status === 401) {
                showStatus('权限不足，请重新登录', 'error');
                return;
            }
            
            if (response.ok) {
                successCount++;
                selectedFiles.delete(filename);
            } else {
                failCount++;
                console.error(`移动 ${filename} 失败:`, response.statusText);
            }
        } catch (error) {
            failCount++;
            console.error(`移动 ${filename} 失败:`, error);
        }
    }
    
    if (successCount > 0) {
        showStatus(`成功移动 ${successCount} 个文件到 ${targetPath}${failCount > 0 ? `，失败 ${failCount} 个` : ''}`, 
                  failCount > 0 ? 'warning' : 'success', 4000);
        refreshFileList();
    } else if (failCount > 0) {
        showStatus(`移动失败，共 ${failCount} 个文件移动失败`, 'error');
    }
    
    updateSelectionUI();
}

// ==================== 多选模式功能结束 ====================

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
        const headers = {};
        if (authToken) {
            headers['Authorization'] = authToken;
        }
        
        const response = await fetch(`${currentPath}?json`, { 
            headers,
            credentials: 'omit'
        });
        
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
        const filePath = currentPath + (currentPath.endsWith('/') ? '' : '/') + file.name;
        const isSelected = selectedFiles.has(file.name);
        
        // 根据多选模式和设备类型选择事件处理
        let clickHandler;
        if (isMultiSelectMode) {
            clickHandler = `onclick="handleFileSelection('${file.name}', ${isDir})"`;
        } else {
            clickHandler = isMobileDevice() 
                ? `onclick="handleMobileDoubleClick(event, '${file.name}', ${isDir})"` 
                : `onclick="handleFileClick('${file.name}', ${isDir})"`;
        }
        
        // 构建复选框（仅在多选模式下显示）
        const checkboxHtml = isMultiSelectMode 
            ? `<input type="checkbox" class="file-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); handleFileSelection('${file.name}', ${isDir})">` 
            : '';
        
        html += `
            <div class="file-item ${isSelected ? 'selected' : ''}" 
                 ${isMobileDevice() ? '' : 'draggable="true"'} 
                 data-filename="${file.name}"
                 data-is-dir="${isDir}"
                 data-file-path="${filePath}"
                 ${clickHandler}
                 oncontextmenu="handleRightClick(event, '${file.name}', ${isDir})"
                 ${isMobileDevice() ? '' : `ondragstart="handleDragStart(event, '${file.name}')"`}
                 ${isMobileDevice() ? '' : `ondragover="handleDragOver(event, ${isDir})"`}
                 ${isMobileDevice() ? '' : `ondragleave="handleDragLeave(event, ${isDir})"`}
                 ${isMobileDevice() ? '' : `ondrop="handleDrop(event, '${file.name}', ${isDir})"`}>
                ${checkboxHtml}
                <div class="file-info">
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${file.name}</span>
                    ${size ? `<span class="file-size">${size}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    fileList.innerHTML = html;
    
    // 在多选模式下更新选择状态UI
    if (isMultiSelectMode) {
        updateSelectionUI();
    }
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
    // 权限检查
    if (!requireAuth('文件上传')) {
        return;
    }
    
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
            const uploadPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(file.name);
            const headers = {
                'Authorization': authToken
            };
            
            const response = await fetch(uploadPath, {
                method: 'PUT',
                body: file,
                headers: headers,
                credentials: 'omit'
            });
            
            if (response.status === 401) {
                throw new Error('权限不足，请重新登录');
            } else if (!response.ok) {
                throw new Error(`上传失败: ${response.statusText}`);
            }
        } catch (error) {
            showStatus(`上传 ${file.name} 失败: ${error.message}`, 'error');
            progressDiv.style.display = 'none';
            return;
        }
    }
    
    progressDiv.style.display = 'none';
    showStatus(`成功上传 ${files.length} 个文件`);
    refreshFileList();
}

// 下载文件
function downloadFile(filename) {
    const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
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
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename) + '?hash';
        console.log('Fetching hash from URL:', url);
        
        const headers = {};
        if (authToken) {
            headers['Authorization'] = authToken;
        }
        
        const response = await fetch(url, {
            headers,
            credentials: 'omit'
        });
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

// 撤销删除的相关变量
let lastDeletedFile = null;
let deleteTimeoutId = null;

// 删除文件/文件夹
async function deleteFile(filename) {
    // 权限检查
    if (!requireAuth('删除文件')) {
        return;
    }
    
    try {
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
        const response = await fetch(url, { 
            method: 'DELETE',
            headers: {
                'Authorization': authToken
            },
            credentials: 'omit'
        });
        
        if (response.status === 401) {
            showStatus('权限不足，请重新登录', 'error');
            return;
        }
        
        if (!response.ok) throw new Error('删除失败');
        
        // 保存删除信息用于撤销
        lastDeletedFile = {
            filename: filename,
            path: currentPath,
            url: url
        };
        
        // 显示可撤销的删除消息
        showDeletionStatus(`已删除 ${filename}`, filename);
        refreshFileList();
    } catch (error) {
        showStatus('删除失败: ' + error.message, 'error');
    }
}

// 显示删除状态消息（可撤销）
function showDeletionStatus(message, filename) {
    const statusDiv = document.getElementById('statusMessage');
    
    // 清除之前的撤销计时器
    if (deleteTimeoutId) {
        clearTimeout(deleteTimeoutId);
    }
    
    statusDiv.innerHTML = `
        <div class="status deletion">
            ${message}
            <button class="undo-btn" onclick="undoDelete()">撤销</button>
            <span class="countdown" id="deleteCountdown">5</span>
        </div>
    `;
    
    // 开始倒计时
    let countdown = 5;
    const countdownElement = document.getElementById('deleteCountdown');
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownElement) {
            countdownElement.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            statusDiv.innerHTML = '';
            lastDeletedFile = null;
        }
    }, 1000);
    
    // 5秒后自动清除
    deleteTimeoutId = setTimeout(() => {
        statusDiv.innerHTML = '';
        lastDeletedFile = null;
        clearInterval(countdownInterval);
    }, 5000);
}

// 撤销删除
async function undoDelete() {
    if (!lastDeletedFile) {
        showStatus('没有可撤销的删除操作', 'error');
        return;
    }
    
    showStatus('撤销删除功能暂不支持，请从回收站还原', 'error');
    
    // 清除删除状态
    if (deleteTimeoutId) {
        clearTimeout(deleteTimeoutId);
    }
    document.getElementById('statusMessage').innerHTML = '';
    lastDeletedFile = null;
}

// 移动文件
async function moveFile(filename) {
    // 权限检查
    if (!requireAuth('移动文件')) {
        return;
    }
    
    const newPath = prompt(`请输入 "${filename}" 的新路径:`, currentPath + '/' + filename);
    if (!newPath || newPath === currentPath + '/' + filename) return;
    
    try {
        const oldUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
        const newUrl = newPath + (newPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
        
        const response = await fetch(oldUrl, {
            method: 'MOVE',
            headers: {
                'Authorization': authToken,
                'Destination': window.location.origin + newUrl
            },
            credentials: 'omit'
        });
        
        if (response.status === 401) {
            showStatus('权限不足，请重新登录', 'error');
            return;
        }
        
        if (!response.ok) throw new Error('移动失败');
        
        showStatus(`成功移动 ${filename} 到 ${newPath}`);
        refreshFileList();
    } catch (error) {
        showStatus('移动失败: ' + error.message, 'error');
    }
}

// 移动端移动文件（通过输入目标路径）
async function moveFilePrompt(filename) {
    // 权限检查
    if (!requireAuth('移动文件')) {
        return;
    }
    
    const currentDir = currentPath === '/' ? '' : currentPath;
    const defaultPath = currentDir + '/' + filename;
    const newPath = prompt(`请输入 "${filename}" 的新路径:`, defaultPath);
    
    if (!newPath || newPath === defaultPath) return;
    
    try {
        const oldUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
        
        const response = await fetch(oldUrl, {
            method: 'MOVE',
            headers: {
                'Authorization': authToken,
                'Destination': window.location.origin + newPath
            },
            credentials: 'omit'
        });
        
        if (response.status === 401) {
            showStatus('权限不足，请重新登录', 'error');
            return;
        }
        
        if (!response.ok) throw new Error('移动失败');
        
        showStatus(`成功移动 ${filename} 到 ${newPath}`);
        refreshFileList();
    } catch (error) {
        showStatus('移动失败: ' + error.message, 'error');
    }
}

// 创建文件夹
async function createFolder() {
    // 权限检查
    if (!requireAuth('创建文件夹')) {
        return;
    }
    
    const folderName = prompt('请输入文件夹名称:');
    if (!folderName) return;
    
    try {
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(folderName);
        const response = await fetch(url, { 
            method: 'MKCOL',
            headers: {
                'Authorization': authToken
            },
            credentials: 'omit'
        });
        
        if (response.status === 401) {
            showStatus('权限不足，请重新登录', 'error');
            return;
        }
        
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
        const headers = {};
        if (authToken) {
            headers['Authorization'] = authToken;
        }
        
        const response = await fetch(`${currentPath}?q=${encodeURIComponent(query)}&json`, {
            headers,
            credentials: 'omit'
        });
        
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

// 检查是否为图片文件
function isImageFile(filename) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const ext = filename.split('.').pop().toLowerCase();
    return imageExtensions.includes(ext);
}

// 检查是否为压缩文件
function isArchiveFile(filename) {
    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tar.gz', 'tar.bz2', 'tar.xz'];
    const ext = filename.toLowerCase();
    // 检查常见的压缩文件扩展名
    return archiveExtensions.some(extension => ext.endsWith('.' + extension));
}

// 检查是否为文本文件
function isTextFile(filename) {
    const textExtensions = ['txt', 'md', 'js', 'html', 'css', 'json', 'xml', 'csv', 'log', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'sh', 'bat', 'py', 'php', 'cpp', 'c', 'h', 'java', 'go', 'rs', 'ts', 'jsx', 'tsx', 'vue', 'svelte', 'sql', 'properties', 'toml'];
    const ext = filename.split('.').pop().toLowerCase();
    return textExtensions.includes(ext);
}

// 预览图片
function previewImage(filename) {
    const imageUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
    
    // 创建预览覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.onclick = closeImagePreview;
    
    overlay.innerHTML = `
        <div class="image-preview-container">
            <div class="image-preview-header">
                <span class="image-title">${filename}</span>
                <button class="close-btn" onclick="closeImagePreview()">✕</button>
            </div>
            <div class="image-preview-content">
                <img src="${imageUrl}" alt="${filename}" class="preview-image" 
                     onerror="this.parentElement.innerHTML='<div class=&quot;error-message&quot;>无法加载图片</div>'"
                     onload="this.style.opacity='1'">
            </div>
            <div class="image-preview-actions">
                <button class="btn" onclick="downloadFile('${filename}')">下载图片</button>
                <button class="btn" onclick="window.open('${imageUrl}', '_blank')">新窗口打开</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

// 移动端触摸处理
let touchTimeout = null;
let lastTouchTime = 0;

// 检测是否为移动设备
function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 处理移动端双击
function handleMobileDoubleClick(event, filename, isDir) {
    const currentTime = new Date().getTime();
    const timeDiff = currentTime - lastTouchTime;
    
    // 防止事件冒泡
    event.stopPropagation();
    
    if (timeDiff < 300 && timeDiff > 50) {
        // 双击 - 显示右键菜单
        event.preventDefault();
        clearTimeout(touchTimeout);
        handleRightClick(event, filename, isDir);
        lastTouchTime = 0; // 重置时间
    } else {
        // 单击 - 延迟执行以检测是否为双击
        if (touchTimeout) {
            clearTimeout(touchTimeout);
        }
        
        touchTimeout = setTimeout(() => {
            handleFileClick(filename, isDir);
        }, 350);
    }
    
    lastTouchTime = currentTime;
}

// 处理文件点击
function handleFileClick(filename, isDir) {
    if (isDir) {
        // 文件夹 - 导航进入
        const newPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + filename;
        navigateTo(newPath);
    } else {
        // 文件 - 检查类型并处理
        if (isImageFile(filename)) {
            previewImage(filename);
        } else if (isTextFile(filename)) {
            editTextFile(filename);
        } else {
            downloadFile(filename);
        }
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
    contextMenu.style.zIndex = '1000';
    
    // 先添加到DOM以获取尺寸
    document.body.appendChild(contextMenu);
    
    let menuItems = '';      if (!isDir) {
        // 文件的右键菜单
        if (isImageFile(filename)) {
            menuItems += `
                <div class="context-menu-item" onclick="previewImage('${filename}'); removeContextMenu();">
                    👁️ 预览图片
                </div>
            `;
        }
        
        // 文本文件添加编辑选项
        if (isTextFile(filename)) {
            menuItems += `
                <div class="context-menu-item" onclick="editTextFile('${filename}'); removeContextMenu();">
                    ✏️ 编辑文本
                </div>
            `;
        }
        
        // 压缩文件添加解压缩选项
        if (isArchiveFile(filename)) {
            menuItems += `
                <div class="context-menu-item" onclick="extractArchive('${filename}'); removeContextMenu();">
                    📦 解压缩
                </div>
            `;
        }
        
        menuItems += `
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
        </div>`;
        
    // 移动端添加移动文件选项
    if (isMobileDevice()) {
        menuItems += `
            <div class="context-menu-item" onclick="moveFilePrompt('${filename}'); removeContextMenu();">
                📁 移动文件
            </div>`;
    }
    
    menuItems += `
        <div class="context-menu-item" onclick="getFileInfo('${filename}'); removeContextMenu();">
            ℹ️ 属性
        </div>
        <div class="context-menu-separator"></div>        <div class="context-menu-item context-menu-danger" onclick="handleContextDelete('${filename}'); removeContextMenu();">
            🗑️ 删除${isMultiSelectMode && selectedFiles.size > 0 && selectedFiles.has(filename) ? ` (${selectedFiles.size}个)` : ''}
        </div>
    `;contextMenu.innerHTML = menuItems;
    
    // 计算菜单位置，避免超出屏幕
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = event.clientX;
    let top = event.clientY;
    
    // 确保菜单不会超出右边界
    if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width - 10;
    }
    
    // 确保菜单不会超出底部边界
    if (top + menuRect.height > viewportHeight) {
        top = viewportHeight - menuRect.height - 10;
    }
    
    // 确保菜单不会超出左边界和顶部边界
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
    
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

// 处理右键菜单的删除操作
function handleContextDelete(filename) {
    if (isMultiSelectMode && selectedFiles.size > 0) {
        // 多选模式下，如果点击的文件已选中，则删除所有选中的文件
        if (selectedFiles.has(filename)) {
            deleteSelectedFiles();
        } else {
            // 如果点击的文件未选中，则只删除这个文件
            deleteFile(filename);
        }
    } else {
        // 非多选模式或没有选中文件，只删除单个文件
        deleteFile(filename);
    }
}

// 重命名文件
async function renameFile(oldName) {
    // 权限检查
    if (!requireAuth('重命名文件')) {
        return;
    }
    
    const newName = prompt(`请输入新的文件名:`, oldName);
    if (!newName || newName === oldName) return;
    
    try {
        const oldUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(oldName);
        const newUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(newName);
        
        const response = await fetch(oldUrl, {
            method: 'MOVE',
            headers: {
                'Authorization': authToken,
                'Destination': window.location.origin + newUrl
            },
            credentials: 'omit'
        });
        
        if (response.status === 401) {
            showStatus('权限不足，请重新登录', 'error');
            return;
        }
        
        if (!response.ok) throw new Error('重命名失败');
        
        showStatus(`成功将 ${oldName} 重命名为 ${newName}`);
        refreshFileList();
    } catch (error) {
        showStatus('重命名失败: ' + error.message, 'error');
    }
}

// 关闭图片预览
function closeImagePreview() {
    const overlay = document.querySelector('.image-preview-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 拖拽开始
let draggedItem = null;
let draggedItems = null; // 用于多选拖拽
function handleDragStart(event, filename) {
    // 如果在多选模式下且该文件已选中，则拖拽所有选中的文件
    if (isMultiSelectMode && selectedFiles.has(filename)) {
        draggedItems = Array.from(selectedFiles);
        draggedItem = null;
    } else {
        // 单文件拖拽
        draggedItem = {
            filename: filename,
            sourcePath: currentPath
        };
        draggedItems = null;
    }
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', filename);
    
    // 添加拖拽样式
    event.target.style.opacity = '0.5';
}

// 拖拽悬停
function handleDragOver(event, isDir) {
    if (!isDir || (!draggedItem && !draggedItems)) return;
    
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
    
    if (!isTargetDir || (!draggedItem && !draggedItems)) return;
    
    // 权限检查
    if (!requireAuth('移动文件')) {
        return;
    }
    
    let filesToMove = [];
    let sourcePath = currentPath;
    
    // 确定要移动的文件列表
    if (draggedItems) {
        // 多选文件拖拽
        filesToMove = draggedItems;
    } else if (draggedItem) {
        // 单文件拖拽
        filesToMove = [draggedItem.filename];
        sourcePath = draggedItem.sourcePath;
    }
    
    const targetPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + targetFolderName;
    
    // 防止移动到自己
    if (filesToMove.includes(targetFolderName)) {
        showStatus('不能将文件夹移动到自己内部', 'error');
        resetDragState();
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const filename of filesToMove) {
        try {
            const oldUrl = sourcePath + (sourcePath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
            const newUrl = targetPath + '/' + encodeURIComponent(filename);
            
            const response = await fetch(oldUrl, {
                method: 'MOVE',
                headers: {
                    'Authorization': authToken,
                    'Destination': window.location.origin + newUrl
                },
                credentials: 'omit'
            });
            
            if (response.status === 401) {
                showStatus('权限不足，请重新登录', 'error');
                resetDragState();
                return;
            }
            
            if (response.ok) {
                successCount++;
                // 如果是多选模式，从选中列表中移除
                if (draggedItems) {
                    selectedFiles.delete(filename);
                }
            } else {
                failCount++;
                console.error(`移动 ${filename} 失败:`, response.statusText);
            }
        } catch (error) {
            failCount++;
            console.error(`移动 ${filename} 失败:`, error);
        }
    }
    
    if (successCount > 0) {
        const message = filesToMove.length === 1 
            ? `成功将 ${filesToMove[0]} 移动到 ${targetFolderName}`
            : `成功移动 ${successCount} 个文件到 ${targetFolderName}${failCount > 0 ? `，失败 ${failCount} 个` : ''}`;
        showStatus(message, failCount > 0 ? 'warning' : 'success');
        refreshFileList();
        if (draggedItems) {
            updateSelectionUI();
        }
    } else if (failCount > 0) {
        showStatus(`移动失败，共 ${failCount} 个文件移动失败`, 'error');
    }
    
    resetDragState();
}

// 重置拖拽状态
function resetDragState() {
    draggedItem = null;
    draggedItems = null;
}

// 处理面包屑拖拽悬停
function handleBreadcrumbDragOver(event, targetPath) {
    if (!draggedItem && !draggedItems) return;
    
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
    
    if (!draggedItem && !draggedItems) return;
    
    // 权限检查
    if (!requireAuth('移动文件')) {
        return;
    }
    
    let filesToMove = [];
    let sourcePath = currentPath;
    
    // 确定要移动的文件列表
    if (draggedItems) {
        // 多选文件拖拽
        filesToMove = draggedItems;
    } else if (draggedItem) {
        // 单文件拖拽
        filesToMove = [draggedItem.filename];
        sourcePath = draggedItem.sourcePath;
    }
    
    // 防止移动到相同位置
    if (sourcePath === targetPath) {
        showStatus('文件已在该位置', 'error');
        resetDragState();
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const filename of filesToMove) {
        try {
            const oldUrl = sourcePath + (sourcePath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
            const newUrl = targetPath + (targetPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
            
            const response = await fetch(oldUrl, {
                method: 'MOVE',
                headers: {
                    'Authorization': authToken,
                    'Destination': window.location.origin + newUrl
                },
                credentials: 'omit'
            });
            
            if (response.status === 401) {
                showStatus('权限不足，请重新登录', 'error');
                resetDragState();
                return;
            }
            
            if (response.ok) {
                successCount++;
                // 如果是多选模式，从选中列表中移除
                if (draggedItems) {
                    selectedFiles.delete(filename);
                }
            } else {
                failCount++;
                console.error(`移动 ${filename} 失败:`, response.statusText);
            }
        } catch (error) {
            failCount++;
            console.error(`移动 ${filename} 失败:`, error);
        }
    }
    
    if (successCount > 0) {
        const message = filesToMove.length === 1 
            ? `成功将 ${filesToMove[0]} 移动到 ${targetPath}`
            : `成功移动 ${successCount} 个文件到 ${targetPath}${failCount > 0 ? `，失败 ${failCount} 个` : ''}`;
        showStatus(message, failCount > 0 ? 'warning' : 'success');
        refreshFileList();
        if (draggedItems) {
            updateSelectionUI();
        }
    } else if (failCount > 0) {
        showStatus(`移动失败，共 ${failCount} 个文件移动失败`, 'error');
    }
    
    resetDragState();
}

// 解压缩文件
async function extractArchive(filename) {
    // 权限检查
    if (!requireAuth('解压缩文件')) {
        return;
    }
    
    const ext = filename.toLowerCase();
    
    // 目前仅支持 ZIP 文件的客户端解压缩
    if (!ext.endsWith('.zip')) {
        const supportedFormat = ext.endsWith('.zip') ? 'ZIP' : 
                               ext.endsWith('.rar') ? 'RAR' : 
                               ext.endsWith('.7z') ? '7Z' : 
                               ext.endsWith('.tar') ? 'TAR' : 
                               ext.endsWith('.gz') ? 'GZ' : 'Unknown';
        showStatus(`暂不支持 ${supportedFormat} 格式的解压缩，目前仅支持 ZIP 文件`, 'error');
        return;
    }
    
    // 询问用户解压缩到哪个目录
    const defaultExtractPath = filename.substring(0, filename.lastIndexOf('.'));
    const extractFolderName = prompt(`请输入解压缩目标文件夹名称:`, defaultExtractPath);
    
    if (!extractFolderName) return;
    
    // 验证文件夹名称
    if (extractFolderName.includes('/') || extractFolderName.includes('\\') || extractFolderName.includes('..')) {
        showStatus('文件夹名称不能包含路径分隔符或相对路径', 'error');
        return;
    }
    
    try {
        showStatus('正在下载并解压缩ZIP文件，请稍候...', 'success');
        
        // 下载ZIP文件
        const zipUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
        const headers = {};
        if (authToken) {
            headers['Authorization'] = authToken;
        }
        
        const response = await fetch(zipUrl, {
            headers,
            credentials: 'omit'
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('ZIP文件不存在');
            } else if (response.status === 403) {
                throw new Error('没有权限访问ZIP文件');
            } else {
                throw new Error(`下载ZIP文件失败 (${response.status})`);
            }
        }
        
        const zipArrayBuffer = await response.arrayBuffer();
        
        // 检查文件大小
        if (zipArrayBuffer.byteLength === 0) {
            throw new Error('ZIP文件为空');
        }
        
        // 检查是否有JSZip库可用
        if (typeof JSZip === 'undefined') {
            showStatus('解压缩功能需要JSZip库支持。请检查网络连接后刷新页面重试。', 'error');
            return;
        }        
        // 使用JSZip解压缩
        const zip = new JSZip();
        let zipData;
        
        try {
            zipData = await zip.loadAsync(zipArrayBuffer);
        } catch (error) {
            throw new Error('ZIP文件格式错误或已损坏');
        }
        
        // 检查ZIP文件是否为空
        const allFiles = Object.keys(zipData.files);
        if (allFiles.length === 0) {
            throw new Error('ZIP文件中没有任何文件');
        }
        
        // 先创建目标文件夹
        const createResult = await createFolderSilent(extractFolderName);
        if (!createResult) {
            // 如果创建失败，检查是否是因为文件夹已存在
            const confirmOverwrite = confirm(`文件夹 "${extractFolderName}" 已存在，是否继续解压缩？可能会覆盖同名文件。`);
            if (!confirmOverwrite) {
                showStatus('解压缩已取消', 'error');
                return;
            }
        }
        
        const extractPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + extractFolderName;
        let extractedCount = 0;
        let failedCount = 0;
        let totalFiles = Object.keys(zipData.files).filter(path => !zipData.files[path].dir).length;
        
        if (totalFiles === 0) {
            showStatus('ZIP文件中没有可解压缩的文件', 'error');
            return;
        }
        
        showStatus(`发现 ${totalFiles} 个文件，开始解压缩...`, 'success');
        
        // 收集所有需要创建的目录
        const dirsToCreate = new Set();
        Object.keys(zipData.files).forEach(relativePath => {
            const pathParts = relativePath.split('/');
            let currentPath = '';
            for (let i = 0; i < pathParts.length - 1; i++) {
                currentPath += pathParts[i] + '/';
                dirsToCreate.add(currentPath);
            }
        });
        
        // 创建目录结构
        for (const dirPath of Array.from(dirsToCreate).sort()) {
            if (dirPath) {
                await createFolderSilent(extractFolderName + '/' + dirPath.slice(0, -1));
            }
        }
        
        // 解压缩每个文件
        for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
            if (!zipEntry.dir) {
                try {
                    const fileContent = await zipEntry.async('blob');
                    const fileUrl = extractPath + '/' + encodeURIComponent(relativePath);
                    
                    const uploadResponse = await fetch(fileUrl, {
                        method: 'PUT',
                        body: fileContent,
                        headers: {
                            'Authorization': authToken
                        },
                        credentials: 'omit'
                    });
                    
                    if (uploadResponse.ok) {
                        extractedCount++;
                        showStatus(`正在解压缩: ${extractedCount}/${totalFiles} - ${relativePath}`, 'success');
                    } else {
                        failedCount++;
                        console.warn(`Failed to upload ${relativePath}: ${uploadResponse.status}`);
                    }
                } catch (error) {
                    failedCount++;
                    console.warn(`Failed to extract ${relativePath}:`, error);
                }
            }
        }
        
        // 显示最终结果
        if (failedCount === 0) {
            showStatus(`✅ 成功解压缩 ${extractedCount} 个文件到文件夹 "${extractFolderName}"`, 'success', 5000);
        } else {
            showStatus(`⚠️ 解压缩完成：成功 ${extractedCount} 个，失败 ${failedCount} 个文件`, 'warning', 5000);
        }
        refreshFileList();
        
    } catch (error) {
        showStatus('解压缩失败: ' + error.message, 'error');
        console.error('Extract error:', error);
    }
}

// 静默创建文件夹（不显示成功消息）
async function createFolderSilent(folderName) {
    try {
        const url = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(folderName);
        const response = await fetch(url, { 
            method: 'MKCOL',
            headers: {
                'Authorization': authToken
            },
            credentials: 'omit'
        });
        
        if (!response.ok && response.status !== 409) { // 409表示文件夹已存在
            throw new Error('创建文件夹失败');
        }
        
        return true;
    } catch (error) {
        console.warn('Create folder warning:', error);
        return false;
    }
}

// 编辑文本文件
async function editTextFile(filename) {
    try {
        // 获取文件内容
        const fileUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
        const headers = {};
        if (authToken) {
            headers['Authorization'] = authToken;
        }
        
        const response = await fetch(fileUrl, {
            headers,
            credentials: 'omit'
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('文件不存在');
            } else if (response.status === 403) {
                throw new Error('没有权限访问文件');
            } else {
                throw new Error(`读取文件失败 (${response.status})`);
            }
        }
          // 使用 arrayBuffer 然后自动检测编码并转换为文本
        const arrayBuffer = await response.arrayBuffer();
        const content = decodeTextWithAutoDetection(arrayBuffer);
        
        showTextEditor(filename, content);
        
    } catch (error) {
        showStatus('读取文件失败: ' + error.message, 'error');
    }
}

// 显示文本编辑器
function showTextEditor(filename, content) {
    // 创建编辑器覆盖层
    const overlay = document.createElement('div');
    overlay.id = 'textEditorOverlay';
    overlay.className = 'text-editor-overlay';
    
    overlay.innerHTML = `
        <div class="text-editor-container">
            <div class="text-editor-header">
                <div class="editor-title">
                    <span class="editor-icon">📝</span>
                    <span class="editor-filename">${filename}</span>
                </div>
                <div class="editor-actions">
                    <button class="btn btn-secondary" onclick="closeTextEditor()">取消</button>
                    <button class="btn btn-primary" onclick="saveTextFile('${filename}')">保存</button>
                    <button class="close-btn" onclick="closeTextEditor()">✕</button>
                </div>
            </div>
            <div class="text-editor-content">
                <textarea 
                    id="textEditor" 
                    class="text-editor-textarea" 
                    placeholder="在此编辑文本内容..."
                    spellcheck="false"
                >${content}</textarea>
            </div>
            <div class="text-editor-footer">
                <div class="editor-stats">
                    <span id="editorStats">字符数: ${content.length}</span>
                </div>                <div class="editor-info">
                    <span class="editor-tip">💡 提示: Ctrl+S 快速保存，Esc 关闭编辑器，Ctrl+Shift+T 新建文本文件</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
      // 聚焦到编辑器
    const textarea = document.getElementById('textEditor');
    textarea.focus();
    
    // 设置原始内容用于检测未保存更改
    textarea.dataset.originalContent = content;
    
    // 更新字符统计
    textarea.addEventListener('input', updateEditorStats);
    
    // 键盘快捷键
    overlay.addEventListener('keydown', handleEditorKeydown);
    
    // 防止背景滚动
    document.body.style.overflow = 'hidden';
}

// 更新编辑器统计信息
function updateEditorStats() {
    const textarea = document.getElementById('textEditor');
    const statsElement = document.getElementById('editorStats');
    if (textarea && statsElement) {
        const content = textarea.value;
        const lines = content.split('\n').length;
        statsElement.textContent = `字符数: ${content.length} | 行数: ${lines}`;
    }
}

// 处理编辑器键盘快捷键
function handleEditorKeydown(event) {
    // Ctrl/Cmd + S: 保存文件
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        const overlay = document.getElementById('textEditorOverlay');
        if (overlay) {
            const filename = overlay.querySelector('.editor-filename').textContent;
            saveTextFile(filename);
        }
    }
    
    // Escape: 关闭编辑器
    if (event.key === 'Escape') {
        event.preventDefault();
        closeTextEditor();
    }
}

// 保存文本文件
async function saveTextFile(filename) {
    // 权限检查
    if (!requireAuth('保存文件')) {
        return;
    }
    
    const textarea = document.getElementById('textEditor');
    if (!textarea) {
        showStatus('编辑器不存在', 'error');
        return;
    }
    
    const content = textarea.value;
    const fileUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
    
    try {
        showStatus('正在保存文件...', 'info');
        
        // 使用 TextEncoder 确保正确处理中文编码
        const encoder = new TextEncoder();
        const encodedContent = encoder.encode(content);
        
        const response = await fetch(fileUrl, {
            method: 'PUT',
            body: encodedContent,
            headers: {
                'Authorization': authToken,
                'Content-Type': 'text/plain; charset=utf-8'
            },
            credentials: 'omit'
        });
        
        if (response.status === 401) {
            showStatus('权限不足，请重新登录', 'error');
            return;
        }
        
        if (!response.ok) {
            throw new Error(`保存失败 (${response.status})`);
        }
          showStatus(`✅ 成功保存文件: ${filename}`, 'success', 3000);
        
        // 更新原始内容标记
        const textarea = document.getElementById('textEditor');
        if (textarea) {
            textarea.dataset.originalContent = content;
        }
        
        closeTextEditor();
        refreshFileList(); // 刷新文件列表
        
    } catch (error) {
        showStatus('保存文件失败: ' + error.message, 'error');
    }
}

// 关闭文本编辑器
function closeTextEditor() {
    const overlay = document.getElementById('textEditorOverlay');
    if (overlay) {
        overlay.remove();
        // 恢复背景滚动
        document.body.style.overflow = '';
    }
}

// 创建新文本文件
async function createNewTextFile() {
    // 权限检查
    if (!requireAuth('创建文件')) {
        return;
    }
    
    const filename = prompt('请输入新文件名称（建议包含扩展名，如 .txt, .md 等）:');
    if (!filename) return;
    
    // 验证文件名
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        showStatus('文件名不能包含路径分隔符或相对路径', 'error');
        return;
    }
    
    try {
        // 创建空文件
        const fileUrl = currentPath + (currentPath.endsWith('/') ? '' : '/') + encodeURIComponent(filename);
        
        const response = await fetch(fileUrl, {
            method: 'PUT',
            body: '',
            headers: {
                'Authorization': authToken,
                'Content-Type': 'text/plain; charset=utf-8'
            },
            credentials: 'omit'
        });
        
        if (response.status === 401) {
            showStatus('权限不足，请重新登录', 'error');
            return;
        }
        
        if (!response.ok) {
            throw new Error(`创建文件失败 (${response.status})`);
        }
        
        showStatus(`✅ 成功创建文件: ${filename}`, 'success');
        refreshFileList();
        
        // 自动打开编辑器
        setTimeout(() => {
            editTextFile(filename);
        }, 500);
        
    } catch (error) {
        showStatus('创建文件失败: ' + error.message, 'error');
    }
}

// 自动检测文本编码并解码
function decodeTextWithAutoDetection(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // 检测 UTF-16 LE BOM (FF FE)
    if (uint8Array.length >= 2 && uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
        console.log('检测到 UTF-16 LE 编码');
        const decoder = new TextDecoder('utf-16le');
        return decoder.decode(arrayBuffer);
    }
    
    // 检测 UTF-16 BE BOM (FE FF)
    if (uint8Array.length >= 2 && uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
        console.log('检测到 UTF-16 BE 编码');
        const decoder = new TextDecoder('utf-16be');
        return decoder.decode(arrayBuffer);
    }
    
    // 检测 UTF-8 BOM (EF BB BF)
    if (uint8Array.length >= 3 && uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
        console.log('检测到 UTF-8 BOM 编码');
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(arrayBuffer);
    }
    
    // 检测是否可能是 UTF-16 LE (无BOM)
    // UTF-16 LE 的特征是每两个字节中第二个字节经常是0（对于ASCII字符）
    if (uint8Array.length >= 4) {
        let nullByteCount = 0;
        let totalPairs = Math.min(100, Math.floor(uint8Array.length / 2)); // 检查前100对字节
        
        for (let i = 1; i < totalPairs * 2; i += 2) {
            if (uint8Array[i] === 0) {
                nullByteCount++;
            }
        }
        
        // 如果超过30%的奇数位置字节是0，可能是UTF-16 LE
        if (nullByteCount > totalPairs * 0.3) {
            console.log('推测为 UTF-16 LE 编码（无BOM）');
            try {
                const decoder = new TextDecoder('utf-16le');
                const decoded = decoder.decode(arrayBuffer);
                // 检查解码结果是否包含有效字符
                if (decoded && !decoded.includes('\uFFFD')) {
                    return decoded;
                }
            } catch (e) {
                console.log('UTF-16 LE 解码失败，尝试其他编码');
            }
        }
    }
    
    // 尝试 UTF-8 解码
    try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const decoded = decoder.decode(arrayBuffer);
        console.log('使用 UTF-8 编码解码成功');
        return decoded;
    } catch (e) {
        console.log('UTF-8 解码失败，尝试 GBK');
    }
    
    // 最后尝试 GBK (中文系统常见编码)
    try {
        const decoder = new TextDecoder('gbk');
        const decoded = decoder.decode(arrayBuffer);
        console.log('使用 GBK 编码解码');
        return decoded;
    } catch (e) {
        console.log('GBK 解码失败，使用默认UTF-8');
    }
    
    // 如果所有尝试都失败，使用UTF-8并忽略错误
    const decoder = new TextDecoder('utf-8', { fatal: false });
    console.log('使用 UTF-8 编码（忽略错误）');
    return decoder.decode(arrayBuffer);
}
