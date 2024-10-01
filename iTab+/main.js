// ==UserScript==
// @name         iTab新标签页+增强
// @namespace    https://greasyfork.org/zh-CN/users/1267923-samethink
// @version      1.5.2
// @description  加入更多快捷键及易用特性，方便快速打开应用及自由在分组间切换
// @author       samethink
// @match        https://go.itab.link/
// @icon         https://go.itab.link/favicon.ico
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // 配置选项
    const DEFAULT_SETTINGS = {
        SHORTCUTS_HINTS: {name: '启用提示', enabled: true},
        LETTERS_KEYS: {name: '启用字母键', enabled: true},
        SORTING: {name: '启用排序', enabled: true},
        LR_NAVIGATION: {name: '启用应用导航', enabled: true},
    };
    let Settings = GM_getValue('Settings', {});
    {
        const defaultKeys = Object.keys(DEFAULT_SETTINGS);
        const currentKeys = Object.keys(Settings);
        if (defaultKeys.length !== currentKeys.length || !defaultKeys.every((key, index) => key === currentKeys[index])) Settings = DEFAULT_SETTINGS;
    }

    // 状态变量
    let appElements = [];
    let groupElements = [];
    let groupIndexWhichIsActive = -1;
    let groupFocusedAppIndices = [];
    let areAppHintsVisible = false;
    let areGroupHintsVisible = false;

    // 初始化
    function init() {
        setTimeout(() => {
            updateVariablesOfGroup();
            updateVariablesOfApp();
            observeSidebar();
            setupAutoClick()
        }, 1000);

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', () => {
            removeAppHints();
            removeGroupHints()
        });

        document.querySelector('#app-main > itab-date').shadowRoot.querySelector('.app-time').addEventListener('click', () => setTimeout(() => {
            observeSidebar();
            updateVariablesOfGroup()
        }, 100))

        if (Settings.LR_NAVIGATION.enabled) document.querySelector('.app-icon-wrap').addEventListener('click', (event) => {
            let appIcon = event.target.closest('.app-item');
            if (appIcon) highlightAppIcon(Array.prototype.indexOf.call(appElements, appIcon));
        });

        createMenu();
    }

    // 处理按键按下事件
    function handleKeyDown(event) {
        if (event.altKey && !event.ctrlKey) {
            handleShortcuts(event);
        } else {
            handleNavigation(event);
        }
    }

    // 处理快捷键
    function handleShortcuts(event) {
        event.preventDefault();
        updateVariablesOfApp();
        const keyActions = {
            8: () => document.querySelector('.se-close.active').click(),
            48: () => event.shiftKey ? clickAndScrollTo(groupElements[groupElements.length - 1]) : appElements[appElements.length - 1].firstChild.click(),
            187: () => event.shiftKey ? document.querySelector('#appGroupAdd').click() : document.querySelector('.home-menu-item').click(),
            188: () => event.shiftKey ? Settings.SORTING.enabled && sortGroups('asc') : Settings.SORTING.enabled && sortApps('asc'),
            189: () => event.shiftKey || document.querySelector('#menuhomeIcon_3d233b > li:nth-child(4)').click(),
            190: () => event.shiftKey ? Settings.SORTING.enabled && sortGroups('desc') : Settings.SORTING.enabled && sortApps('desc'),
            191: () => document.querySelector('#searchInput').click(),
            192: () => document.querySelector('#app-main > itab-date').shadowRoot.querySelector('.app-time').click(),
        };

        if (keyActions[event.keyCode]) {
            keyActions[event.keyCode]();
        } else if (event.keyCode >= 49 && event.keyCode <= 57) {
            handleAssignment(event, 49);
        } else if (event.keyCode >= 65 && event.keyCode <= 90 && Settings.LETTERS_KEYS.enabled) {
            handleAssignment(event, 56);
        } else if (Settings.SHORTCUTS_HINTS.enabled && !areAppHintsVisible && event.key === 'Alt' && !event.shiftKey) {
            showAppHints();
        } else if (Settings.SHORTCUTS_HINTS.enabled && !areGroupHintsVisible && event.shiftKey) {
            showGroupHints();
        }
    }

    // 处理箭头导航
    function handleNavigation(event) {
        const searchInput = document.querySelector('.se-input-box.active > #searchInput');
        if (searchInput) {
            searchInput.click();
        } else if (event.key === 'ArrowUp') {
            clickAndScrollTo(groupElements[groupIndexWhichIsActive <= 0 ? groupElements.length - 1 : groupIndexWhichIsActive - 1]);
        } else if (event.key === 'ArrowDown') {
            clickAndScrollTo(groupElements[(groupIndexWhichIsActive + 1) % groupElements.length]);
        } else if (Settings.LR_NAVIGATION.enabled && event.key === 'ArrowLeft') {
            updateVariablesOfApp();
            highlightAppIcon(groupFocusedAppIndices[groupIndexWhichIsActive] <= 0 ? appElements.length - 1 : groupFocusedAppIndices[groupIndexWhichIsActive] - 1);
        } else if (Settings.LR_NAVIGATION.enabled && event.key === 'ArrowRight') {
            updateVariablesOfApp();
            highlightAppIcon((groupFocusedAppIndices[groupIndexWhichIsActive] + 1) % appElements.length);
        } else if (Settings.LR_NAVIGATION.enabled && (event.key === ' ' || event.key === 'Enter') && !isSubWindowOpen()) {
            event.preventDefault();
            appElements[groupFocusedAppIndices[groupIndexWhichIsActive]]?.firstChild.click();
        }
    }

    // 更新应用有关变量
    function updateVariablesOfApp() {
        let temp = document.querySelectorAll('.app-icon-item')[groupIndexWhichIsActive];
        appElements = temp ? temp.querySelectorAll('.app-item') : [];
    }

    // 更新分组有关变量
    function updateVariablesOfGroup() {
        let oldGroupCount = groupElements.length;
        groupElements = document.querySelectorAll('.app-sidebar-ul > .app-group-item');
        groupIndexWhichIsActive = Array.prototype.findIndex.call(groupElements, (element) => {
            return element.classList.contains('active');
        });
        if (groupFocusedAppIndices.length === 0) {
            groupFocusedAppIndices = new Array(groupElements.length).fill(-1);
        } else if (groupElements.length < oldGroupCount) {
            groupFocusedAppIndices.pop();
        } else if (groupElements.length > oldGroupCount) {
            groupFocusedAppIndices.push(-1);
        }
    }

    // 检查是否打开了子窗口
    function isSubWindowOpen() {
        for (let element of document.querySelectorAll(".el-overlay-dialog")) {
            if (element.checkVisibility()) return true;
        }
        return false;
    }

    let SidebarObserver = null;

    // 监控侧边栏
    function observeSidebar() {
        if (SidebarObserver instanceof MutationObserver) SidebarObserver.disconnect();  // 解除原先的监控
        const targetNode = document.querySelector('.app-sidebar-ul');
        if (!targetNode) return;
        const config = {attributes: true, childList: true, subtree: true, attributeFilter: ['class']};

        const callback = function (mutationsList) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.target.classList.contains('app-group-item') && mutation.target.classList.contains('active')) {
                    appElements[groupFocusedAppIndices[groupIndexWhichIsActive]]?.setAttribute('hidden', '');
                    updateVariablesOfGroup();
                    updateVariablesOfApp();
                    appElements[groupFocusedAppIndices[groupIndexWhichIsActive]]?.removeAttribute('hidden');
                } else if (mutation.addedNodes.length !== mutation.removedNodes.length) {
                    document.querySelectorAll(".app-item").forEach((element) => {
                        element?.removeAttribute("hidden");
                        element?.removeAttribute("style");
                    });
                }
            }
        };

        SidebarObserver = new MutationObserver(callback);
        SidebarObserver.observe(targetNode, config);
    }

    // 根据数字及字母按键点击对应分组或应用元素
    function handleAssignment(event, offsetNumber) {
        if (event.shiftKey) {
            clickAndScrollTo(groupElements[event.keyCode - offsetNumber])
        } else {
            appElements[event.keyCode - offsetNumber].firstChild.click();
            if (Settings.LR_NAVIGATION.enabled) highlightAppIcon(event.keyCode - offsetNumber)
        }
    }

    // 高亮焦点应用
    function highlightAppIcon(index) {
        appElements[groupFocusedAppIndices[groupIndexWhichIsActive]]?.removeAttribute('style');
        groupFocusedAppIndices[groupIndexWhichIsActive] = index;
        appElements[index].setAttribute('style', 'box-shadow: inset 0 0 4px 2px rgba(255, 255, 255, 0.8), 0 0 8px 4px rgba(255, 255, 255, 0.8)');
    }

    // 应用排序
    function sortApps(order) {
        const grid = document.querySelectorAll('.app-icon-item')[groupIndexWhichIsActive].querySelector('.app-grid');
        const items = Array.from(grid.querySelectorAll('.app-item'));
        items.sort((a, b) => {
            const aTitle = a.querySelector('.app-item-icon').title;
            const bTitle = b.querySelector('.app-item-icon').title;
            return order === 'asc' ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
        });
        items.forEach(item => grid.appendChild(item));
        removeAppHints();

        let navConfig = JSON.parse(localStorage.getItem('navConfig'));
        navConfig[groupIndexWhichIsActive].children.sort((a, b) => order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        localStorage.setItem('navConfig', JSON.stringify(navConfig));
    }

    // 分组排序
    function sortGroups(order) {
        let navConfig = JSON.parse(localStorage.getItem('navConfig'));
        navConfig.sort((a, b) => order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        localStorage.setItem('navConfig', JSON.stringify(navConfig));
        location.reload();
    }

    // 处理按键抬起事件
    function handleKeyUp(event) {
        if (event.key === 'Alt') {
            removeAppHints();
            removeGroupHints();
        } else if (event.key === 'Shift') {
            removeGroupHints();
        }
    }

    // 点击并滚动到目标元素
    function clickAndScrollTo(element) {
        element.click();
        element.scrollIntoView({behavior: 'smooth', block: 'start'});
    }

    // 设置自动点击
    function setupAutoClick() {
        document.querySelector('.home-menu-item').addEventListener('click', () => {
            setTimeout(() => document.querySelector('#app-add-icon > ul > li:nth-child(4)').click(), 100);
            setTimeout(() => document.querySelector('.app-icon-wrap .el-input__wrapper').click(), 200);
        });
    }

    // 显示应用快捷键提示
    function showAppHints() {
        appElements.forEach((item, index) => {
            let title = item.querySelector('.app-item-title');
            title.textContent = (index < 9 ? `「${index + 1}」` : Settings.LETTERS_KEYS.enabled && index < 35 ? `「${String.fromCharCode(index + 56)}」` : '') + title.textContent;
        });
        areAppHintsVisible = true;
    }

    // 显示分组快捷键提示
    function showGroupHints() {
        groupElements.forEach((item, index) => {
            item.querySelector('.app-group-item-title').textContent += ' ' + (index < 9 ? (index + 1) : Settings.LETTERS_KEYS.enabled && index < 35 ? String.fromCharCode(index + 56) : '');
        });
        areGroupHintsVisible = true;
        removeAppHints();
    }

    // 移除应用快捷键提示
    function removeAppHints() {
        if (areAppHintsVisible) {
            appElements.forEach((item, index) => {
                if (index < 9 || (Settings.LETTERS_KEYS.enabled && index < 35)) {
                    let title = item.querySelector('.app-item-title');
                    if (title) title.textContent = title.textContent.substring(3);
                }
            });
            areAppHintsVisible = false;
        }
    }

    // 移除分组快捷键提示
    function removeGroupHints() {
        if (areGroupHintsVisible) {
            groupElements.forEach((item, index) => {
                if (index < 9 || (Settings.LETTERS_KEYS.enabled && index < 35)) {
                    let title = item.querySelector('.app-group-item-title');
                    title.textContent = title.textContent.slice(0, -2);
                }
            });
            areGroupHintsVisible = false;
        }
    }

    // 创建菜单
    function createMenu() {
        // 普通选项
        GM_registerMenuCommand('🧭快捷键说明', showGuideWindow);

        // 开关选项
        Object.values(Settings).forEach(option => {
            option.id = GM_registerMenuCommand((option.enabled ? '🟢' : '🔴') + option.name, () => {
                option.enabled = !option.enabled;
                GM_listValues().forEach(i => GM_deleteValue(i));
                GM_setValue('Settings', Settings);
                Object.values(Settings).forEach(opt => GM_unregisterMenuCommand(opt.id));
                createMenu();
            });
        });
    }

    // 显示快捷键指南
    function showGuideWindow() {
        if (document.querySelector('.overlay')) return;
        const div = document.createElement('div');
        div.classList.add('overlay');
        div.innerHTML = `<div class="container"><h1>快捷键说明</h1><div class="shortcut-section"><h2>一般</h2><ul class="shortcut-list"><li><span>切换简洁模式</span><span class="shortcut-key">Alt + [\`~]</span></li><li><span>激活搜索框</span><span class="shortcut-key">Alt + [/?]</span></li><li><span>清空搜索框</span><span class="shortcut-key">Alt + Backspace</span></li></ul></div><div class="shortcut-section"><h2>应用</h2><ul class="shortcut-list"><li><span>打开应用</span><span class="shortcut-key">Alt + 数字/字母</span></li><li><span>打开最后一个应用</span><span class="shortcut-key">Alt + [0)]</span></li><li><span>删除应用</span><span class="shortcut-key">Alt + [-_]</span></li><li><span>添加应用</span><span class="shortcut-key">Alt + [=+]</span></li><li><span>应用正向排序</span><span class="shortcut-key">Alt + [,&lt;]</span></li><li><span>应用反向排序</span><span class="shortcut-key">Alt + [.&gt;]</span></li><li><span>切换焦点应用（启用应用导航）</span><span class="shortcut-key">方向键左/方向键右</span></li><li><span>打开焦点应用</span><span class="shortcut-key">Space/Enter</span></li></ul></div><div class="shortcut-section"><h2>分组</h2><ul class="shortcut-list"><li><span>跳转分组</span><span class="shortcut-key">Alt + Shift + 数字/字母</span></li><li><span>跳转最后一个分组</span><span class="shortcut-key">Alt + Shift + [0)]</span></li><li><span>添加分组</span><span class="shortcut-key">Alt + Shift + [=+]</span></li><li><span>分组正向排序</span><span class="shortcut-key">Alt + Shift + [,&lt;]</span></li><li><span>分组反向排序</span><span class="shortcut-key">Alt + Shift + [.&gt;]</span></li><li><span>切换分组</span><span class="shortcut-key">方向键上/方向键下</span></li></ul></div><button class="close-btn"id="close-btn">×</button></div><style>.overlay{position:fixed;top:0;left:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}.container{background-color:rgba(255,255,255,0.95);border-radius:8px;padding:15px;box-shadow:0 2px 4px rgba(0,0,0,0.1);overflow-y:auto;max-width:450px;max-height:80vh;width:90%;position:relative;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:14px;color:#333}h1{text-align:center;font-size:16px;color:#222;margin-bottom:15px}h2{font-size:14px;color:#222;border-bottom:1px solid#eee;padding-bottom:5px;margin-bottom:10px}.shortcut-section{font-size:12px;margin-bottom:15px}.shortcut-list{list-style:none;padding:0;margin:0}.shortcut-list li{padding:6px 0;border-bottom:1px solid#eee;display:flex;justify-content:space-between;color:#555}.shortcut-list li:last-child{border-bottom:none}.shortcut-key{background-color:#e1e1e1;padding:2px 6px;border-radius:4px;font-family:'Courier New',Courier,monospace;color:#008cff}.close-btn{position:absolute;top:10px;right:10px;background:none;border:none;font-size:20px;cursor:pointer;color:#333}</style>`;
        document.body.appendChild(div);
        div.addEventListener('click', event => {
            if (event.target === div || event.target.id === 'close-btn') div.remove()
        });
    }

    init();

})();
