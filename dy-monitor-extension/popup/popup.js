document.addEventListener("DOMContentLoaded", () => {
    chrome.runtime.sendMessage({ type: "GET_DATA" }, (res) => {
        if (res && res.data) {
            const items = Object.values(res.data).filter((e) => e && e.length > 0);
            document.getElementById("stat-total").textContent = items.length;
            document.getElementById("stat-new").textContent = items.filter((e) => e.length <= 1).length;
            document.getElementById("stat-changed").textContent = items.filter((e) => e.length >= 2).length;
        }
    });

    document.getElementById("btn-scan").onclick = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "TRIGGER_SCAN" });
        });
        window.close();
    };

    document.getElementById("btn-open").onclick = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_PANEL" });
        });
        window.close();
    };

    document.getElementById("btn-export").onclick = () => {
        chrome.runtime.sendMessage({ type: "EXPORT_DATA" });
        window.close();
    };

    document.getElementById("btn-clear").onclick = () => {
        if (confirm("确定清除所有数据？")) {
            chrome.runtime.sendMessage({ type: "CLEAR_DATA" });
        }
        window.close();
    };
});
