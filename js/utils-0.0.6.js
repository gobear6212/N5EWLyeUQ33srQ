var customPrefix = "";

const currying = (fn, ...params) => ((...more) => fn(...params, ...more));

async function hashString(string, algorithm="SHA-1") {
    let bits = await crypto.subtle.digest(algorithm, new TextEncoder().encode(string));
    return Array.from(new Uint8Array(bits)).join('');
}

function stateEventListener(elem, event, stateChecker, callback) {
    if (stateChecker(elem)) {
        callback();
    } else {
        elem.addEventListener(event, function _someEventHandler() {
            elem.removeEventListener(event, _someEventHandler, false);
            callback();
        }, false)
    }
}

function documentReady(callback, doc=document) {
    const stateChecker = (elem) => elem.readyState !== 'loading';
    stateEventListener(doc, 'DOMContentLoaded', stateChecker, callback);
}

function documentReadyAsync(doc=document) {
    return new Promise((resolve, reject) => {
        documentReady(resolve, doc);
    });
}

async function insertScript(mode, str, callback=null, doc=document) {
    let hash = await hashString(str)
    let match = document.getElementById(hash);
    if (match) {
        callback();
        return match;
    }
    var script = doc.createElement("script");
    script.id = hash;
    script.type = "text/javascript";
    if (mode === "text") {
        script.text = str;
    } else if (mode === "src") {
        script.src = str;
    }
    (doc.head || doc.body || doc.documentElement).appendChild(script);
    if (callback) {
        if (mode === "text") {
            callback();
        } else if (mode === "src") {
            script.addEventListener('load', function() { callback(); });
        }
    }
    return script;
}

async function insertScriptAsync(scriptList, doAsync=true, doc=document) {
    function _insertScriptPromise(mode, str) {
        return new Promise((resolve, reject) => {
            insertScript(mode, str, resolve, doc);
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

async function createMenu(handlerDict) {
    function _createWrapper() {
        let wrapper = document.createElement("div");
        wrapper.id = `${customPrefix}-menu-wrapper`;
        wrapper.innerHTML = `
        <div id="${customPrefix}-menu-box">
            <div id="${customPrefix}-menu-list"></div>
            <hr />
            <input id="${customPrefix}-menu-input" type="text"></input>
        </div>
        `;
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

            #${customPrefix}-menu-list div.${customPrefix}-menu-item {
                margin: ${isMobile? "5px" : "3px"} 0 !important;
                cursor: pointer !important;
            }

            #${customPrefix}-menu-list div.${customPrefix}-menu-item:hover {
                background-color: #f0f0f0 !important;
            }
        `);

        setElemDisplay(wrapper, "toggle");

        if (isMobile) {
            // document.addEventListener("dblclick", () => {
            //     ev.preventDefault();
            // }, true);
            nClicksListener(2, (ev) => {
                _addAdhocItems();
                const isHidden = setElemDisplay(wrapper, "toggle");
            }, ["A", "INPUT", "BUTTON", "IMG"], true);
        } else {
            document.addEventListener("keydown", function(ev) {
                if (ev.keyCode == 48 && ev.ctrlKey) {   // 48 = "0"
                    _addAdhocItems();
                    const isHidden = setElemDisplay(wrapper, "toggle");
                    if (isHidden) {
                        document.getElementById(`${customPrefix}-menu-input`).focus();
                    }
                }
            }, true);
        }
        return wrapper;
    }

    function _registerItems(handlers, parent) {
        for (const [key, value] of Object.entries(handlers)) {
            let item = document.createElement("div");
            item.className = `${customPrefix}-menu-item`;
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
            parent.appendChild(item);
        };
    }
    
    function _addAdhocItems() {
        const origContainer = document.getElementById(`${customPrefix}-menu-list-tmp`);
        if (origContainer) {
            origContainer.remove();
        }

        if (typeof createMenuAdhocHandlerDict !== "undefined" && createMenuAdhocHandlerDict instanceof Object) {
            const container = document.createElement("div");
            container.id = `${customPrefix}-menu-list-tmp`;
            _registerItems(createMenuAdhocHandlerDict, container);
            list.appendChild(container);
        }
    }

    await documentReadyAsync();

    const wrapper = document.getElementById(`${customPrefix}-menu-wrapper`) || _createWrapper(),
          list = document.getElementById(`${customPrefix}-menu-list`);

    _registerItems(handlerDict, list);
}

async function downloadURLs(urls, handler, useXHR=false, ...params) {
    let config = { "method": "GET" };
    async function _downloadURL(url, idx) {
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

    if (useXHR) {
        config = {...config, ...params[0]}
        params.splice(0, 1);
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
