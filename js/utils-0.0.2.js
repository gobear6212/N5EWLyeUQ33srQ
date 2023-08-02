var customPrefix = "";

function documentReady(callback) {
    if (document.readyState !== 'loading') {
        callback();
    } else {
        document.addEventListener('DOMContentLoaded', function _domLoadHandler() {   // i.e. document ready
            document.removeEventListener('DOMContentLoaded', _domLoadHandler, false);
            callback();
        }, false)
    }
}

function documentReadyAsync() {
    return new Promise((resolve, reject) => {
        if (document.readyState !== 'loading') {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', function _domLoadHandler() {   // i.e. document ready
                document.removeEventListener('DOMContentLoaded', _domLoadHandler, false);
                resolve();
            }, false)
        }
    });
}

function insertScript(mode, str, callback=null, doc=document) {
    var script = doc.createElement("script");
    script.type = "text/javascript";
    if (mode === "text") {
        script.text = str;
    } else if (mode === "src") {
        script.src = str;
    }
    (doc.head || doc.body || doc.documentElement).appendChild(script);
    if (callback) {
        script.addEventListener('load', function() {
            callback();
        });
    }
    return script;
}

async function insertScriptAsync(scriptList, doAsync=true, doc=document) {
    function _insertScriptPromise(mode, str) {
        return new Promise((resolve, reject) => {
            var script = doc.createElement("script");
            script.type = "text/javascript";
            if (mode === "text") {
                script.text = str;
            } else if (mode === "src") {
                script.src = str;
            }
            (doc.head || doc.body || doc.documentElement).appendChild(script);
            script.addEventListener('load', () => { resolve() });
        });        
    }

    let promises = [];
    for (const item of scriptList) {
        if (doAsync)
            promises.push(_insertScriptPromise(item[0], item[1]));
        else
            promises.push(await _insertScriptPromise(item[0], item[1]));
    }
    return Promise.all(promises);
}

function insertStylesheet(mode, str, doc=document) {
    let stylesheet;
    if (mode === "text") {
        stylesheet = doc.createElement("style");
        stylesheet.innerHTML = str;
    } else if (mode === "src") {
        stylesheet = doc.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.type = "text/css";
        stylesheet.href = str;
    }
    (doc.head || doc.body || doc.documentElement).appendChild(stylesheet);
    return stylesheet;
}

function insertCookie(key, value, expiry=null, doc=document) {
    if (expiry) {
        var expires = new Date();
        expires.setTime(expires.getTime() + (expiry * 24 * 60 * 60 * 1000));
        doc.cookie = `${key}=${value};domain=${window.location.hostname};expires=${expires.toUTCString()};`;
    } else {
        doc.cookie = `${key}=${value};domain=${window.location.hostname};`;
    }
}

function elemToFullscreen(elem, options) {
    return elem[
        [
            'requestFullscreen',
            'mozRequestFullScreen',
            'msRequestFullscreen',
            'webkitRequestFullscreen'
        ].find((prop) => typeof elem[prop] === 'function')
    ]?.(options);
}

function setElemDisplay(elem, mode) {
    const customHiddenClass = `${customPrefix}-custom-hidden`;
    if (!document.getElementById(customHiddenClass)) {
        const stylesheet = insertStylesheet("text", `.${customHiddenClass} { display: none !important;}`);
        stylesheet.id = customHiddenClass;
    }

    const isHidden = elem.classList.contains(customHiddenClass);
    if (mode !== "toggle") {
        elem.style.display = mode;
        elem.style.setProperty("display", mode, "important");
    } else {
        // first call set to hidden
        elem.classList.toggle(customHiddenClass);
    }
    return isHidden;
}

function nClicksListener(n, handler, excludedTags, isCapturing) {
    let timer = null,
        clicks = 0,
        clickStart = null;
    const clickMinGap = 100,
          clickMaxGap = 200;

    window.addEventListener("click", (ev) => {
        // if (excludedTags.some((tag) => ev.target.closest(tag)))
        if (excludedTags.includes(ev.target.tagName))
            return;

        if ((clickStart === null) || (new Date() - clickStart >= clickMinGap)) {
            clicks++;
            clickStart = new Date();
        }

        if (!timer) {
            timer = setTimeout(() => {
                timer = null;
                clicks = 0;
                clickStart = null;
            }, n * clickMaxGap);
        } else if (clicks === n) {
            handler(ev);
        }
    }, isCapturing);
}

async function createMenu(handler_dict) {
    function _createWrapper() {
        let wrapper = document.createElement("div");
        wrapper.id = `${customPrefix}-menu-wrapper`;
        wrapper.innerHTML = `<div id="${customPrefix}-menu-box"><div id="${customPrefix}-menu-list"></div><hr /><input id="${customPrefix}-menu-input" type="text"></input></div>`;
        document.body.appendChild(wrapper);
        
        insertStylesheet("text", `
            #${customPrefix}-menu-wrapper {
               all: initial;
            }

            #${customPrefix}-menu-wrapper * {
               all: revert !important;
            }

            #${customPrefix}-menu-box {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                z-index: 2147483647 !important;
                max-width: ${isMobile? "60%" : "50%"} !important;
                box-shadow: 0 .125em .25em !important;
                border: 1px !important;
                padding: 0.75em !important;
                border-radius: 0.25em !important;
                background-color: white !important;
                text-align: center !important;
                font-weight: 300 !important;
                font-size: 1em !important;
                font-family: Helvetica, Arial, sans-serif !important;
                color: #2d2d2d !important;
            }

            #${customPrefix}-menu-input {
                width: 90% !important;
                max-width: 100% !important;
            }

            #${customPrefix}-menu-list > div {
                margin: ${isMobile? "5px" : "3px"} 0 !important;
                cursor: pointer !important;
            }

            #${customPrefix}-menu-list > div:hover {
                background-color: #f0f0f0 !important;
            }
        `);

        setElemDisplay(wrapper, "toggle");

        if (isMobile) {
            nClicksListener(2, (ev) => {
                setElemDisplay(wrapper, "toggle");
            }, ["A", "INPUT", "BUTTON"], true);
        } else {
            document.addEventListener("keydown", function(ev) {
                if (ev.keyCode == 48 && ev.ctrlKey) {   // 48 = "0"
                    setElemDisplay(wrapper, "toggle");
                }
            }, true);
        }
        return wrapper
    }

    await documentReadyAsync();

    let wrapper = document.getElementById(`${customPrefix}-menu-wrapper`) || _createWrapper(),
        list = document.getElementById(`${customPrefix}-menu-list`);

    let idx = 0;
    for (const [key, value] of Object.entries(handler_dict)) {
        let item = document.createElement("div");
        item.id = `${customPrefix}-menu-item-${idx}`;
        item.innerHTML = key;
        item.addEventListener("click", (ev) => {
            if (typeof value == "function") {
                let input = document.getElementById(`${customPrefix}-menu-input`).value;
                value(input);
            } else {
                let fn = value[0];
                fn(...value.slice(1));
            }
            setElemDisplay(wrapper, "toggle");
        });
        list.appendChild(item);
        idx += 1;
    };
}

async function downloadURLs(urls, handler, useXHR=false, ...params) {
    async function _downloadURL(url, idx) {
        const config = { "method": "GET" };
        try {
            if (useXHR) {
                let response = await GMxmlHttpRequestAsync(url, config);
                return handler(response, idx, ...params);
            } else {        
                let response = await fetch(url, config);
                if (response.ok) {
                    return handler(response, idx, ...params);
                } else {
                    throw response.status;
                }
            }
        } catch(error) {
            throw [url, error];
        }
    }

    const invalidPatterns = [undefined, null, "", "#"];
    const promises = urls.reduce((accum, url, idx) => {
        if (!invalidPatterns.includes(url) && url.slice(0, 4) === "http")
            accum.push(_downloadURL(url, idx));
        return accum;
    }, []);

    const results = await Promise.allSettled(promises);
    const rejected = results.reduce((accum, result, idx) => {
        if ("reason" in result) {
            if (result.reason instanceof Array && result.reason[0] === urls[idx])
                accum.push(result.reason);
            else
                accum.push([urls[idx], result.reason]);
        }
        return accum;
    }, []);
    return rejected;
}

function GMxmlHttpRequestAsync(url, config) {
    return new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
            ...config,
            "url": url,
            "responseType": "arraybuffer",
            "onload": (response) => resolve(response),
            "onerror": (response) => reject(response.status),
            "ontimeout": (response) => reject(response.status),
        }).catch((err) => reject(err));
    });
}

function fflateZipAsync(zipObject, config) {
    return new Promise((resolve, reject) => {
        fflate.zip(zipObject, config, (err, zipped) => {
            if (!err)  resolve(zipped);
            else  reject(err);
        });
    });
}
