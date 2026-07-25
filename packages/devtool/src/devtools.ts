/// <reference types="chrome" />
/** DevTools bootstrap — the r$ panel + the f(width) sidebar in Elements. */
chrome.devtools.panels.create('r$', '', 'panel.html');
chrome.devtools.panels.elements.createSidebarPane('r$ f(width)', (pane) => {
    pane.setPage('sidebar.html');
});
