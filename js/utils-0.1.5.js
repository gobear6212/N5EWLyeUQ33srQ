/*
Grants the following in the script manager:
    // @grant       GM.xmlHttpRequest
    // @grant       GM_openInTab
    // @grant       GM_addElement
*/

var customPrefix = "";

const currying = (fn, ...params) => ((...more) => fn(...params, ...more));

const trustedTypesPolicy = typeof(trustedTypes) === "undefined" ? null :
                            trustedTypes.createPolicy("escapeCustom", {
                                createHTML: (toEscapeHTML) => toEscapeHTML,
                                createScriptURL: (toEscapeScriptURL) => toEscapeScriptURL,   // warning: this is unsafe!
                                createScript: (toEscapeScript) => toEscapeScript,   // warning: this is unsafe!
                            });

const innerHTMLWrapper = trustedTypesPolicy === null ? 
                            (html) => html :
                            (html) => trustedTypesPolicy.createHTML(html);

const scriptURLWrapper = trustedTypesPolicy === null ? 
                            (scriptURL) => scriptURL :
                            (scriptURL) => trustedTypesPolicy.createScriptURL(scriptURL);

const scriptWrapper = trustedTypesPolicy === null ? 
                            (script) => script :
                            (script) => trustedTypesPolicy.createScript(script);

// inclusive start and end
// descending if start > end and step < 0
function rangeArray(start, end, step=1) {
    const length = (end - start) / step + 1;
    return Array.from({length: length}, (_, index) => start + index * step);
}

function delay(millisecond) {   // in ms
    return new Promise(resolve => setTimeout(resolve, millisecond));
}

// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;

    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

async function hashString(string, algorithm="SHA-1") {
    if (crypto.subtle) {
        const bits = await crypto.subtle.digest(algorithm, new TextEncoder().encode(string));
        return Array.from(new Uint8Array(bits)).join('');
    } else {
        return cyrb53(string);
    }
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

async function insertScript(args=null) {
    if (args === null || typeof args !== "object") {
        return;
    }

    const mode = args["mode"] || null,
          content = args["content"] || null,
          callback = args["callback"] || (() => undefined),
          doc = args["doc"] || document,
          unique = args["unique"] || true,
          useLegacy = args["useLegacy"] || false;

    if (mode === null || content === null) {
        return;
    }
    
    let id = null;
    if (unique) {
        id = args["id"] || await hashString(content);
        const match = doc.getElementById(id);
        if (match) {
            callback();
            return match;            
        }
    }

    let script = null;
    if (useLegacy) {
        script = doc.createElement("script");
        script.id = id;
        script.type = "text/javascript";
        if (mode === "text") {
            script.text = scriptWrapper(content);
        } else if (mode === "src") {
            script.src = scriptURLWrapper(content);
        }
        (doc.head || doc.body || doc.documentElement).appendChild(script);
    } else {
        script = await GM_addElement('script', {
            id: id,
            type: "text/javascript",
            textContent: mode === "text" ? content : "",
            src: mode === "src" ? content : "",
        });
    }

    if (mode === "text") {
        callback();
    } else if (mode === "src") {
        script.addEventListener('load', () => callback());
    }
    return script;
}

async function insertScriptAsync(scriptList, args=null) {
    function _insertScriptPromise(mode=null, content=null, id=null) {
        return new Promise((resolve, reject) => {
            insertScript({
                "mode": mode,
                "content": content,
                "id": id,
                "callback": resolve,
                ...args
            });
        });        
    }

    if (args === null || typeof args !== "object") {
        args = {};
    }

    const sequential = args["sequential"] || false;

    let promises = [];
    for (const item of scriptList) {
        const promise = sequential ? await _insertScriptPromise(...item) : _insertScriptPromise(...item);
        promises.push(promise);
    }
    return Promise.all(promises);
}

async function insertStylesheet(args=null) {
    if (args === null || typeof args !== "object") {
        return;
    }

    const mode = args["mode"] || null,
          content = args["content"] || null,
          doc = args["doc"] || document,
          unique = args["unique"] || true;

    if (mode === null || content === null) {
        return;
    }

    let id = null;
    if (unique) {
        id = args["id"] || await hashString(content);
        const match = doc.getElementById(id);
        if (match) {
            return match;
        }
    }

    let stylesheet;
    if (mode === "text") {
        // stylesheet = doc.createElement("style");
        // stylesheet.innerText = content;
        stylesheet = await GM_addElement('style', {
            textContent: content
        });
    } else if (mode === "src") {
        // stylesheet = doc.createElement("link");
        // stylesheet.rel = "stylesheet";
        // stylesheet.type = "text/css";
        // stylesheet.href = content;
        stylesheet = await GM_addElement('link', {
            rel: "stylesheet",
            type: "text/css",
            href: content,
        });
    }
    stylesheet.id = id;
    // (doc.head || doc.body || doc.documentElement).appendChild(stylesheet);
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

async function setElemDisplay(elem, mode) {
    const customHiddenClass = `${customPrefix}-custom-hidden`;
    const _ = await insertStylesheet({
        "mode": "text",
        "content": `.${customHiddenClass} { display: none !important;}`,
        "unique": true,
        "id": `${customPrefix}-setElemDisplay-style`
    });

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

// handlerDict = {
//     "handler": function,
//     "args": Array,
//     "needInput": Boolean,
//     "checker": function,
// }
async function createMenu(handlerDict) {
    async function _createWrapper() {
        let wrapper = document.createElement("div");
        wrapper.id = `${customPrefix}-menu-wrapper`;
        wrapper.innerHTML = innerHTMLWrapper(`
        <div id="${customPrefix}-menu-box">
            <div id="${customPrefix}-menu-list"></div>
            <hr />
            <input id="${customPrefix}-menu-input" type="text"></input>
        </div>
        `);
        document.body.appendChild(wrapper);
        
        const _ = await insertStylesheet({
            "mode": "text",
            "content": `
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

                #${customPrefix}-menu-list div.${customPrefix}-menu-row {
                    margin: ${isMobile? "5px" : "3px"} 0 !important;
                }

                #${customPrefix}-menu-list div.${customPrefix}-menu-item {
                    cursor: pointer !important;
                }

                #${customPrefix}-menu-list div.${customPrefix}-menu-item.${customPrefix}-half-width {
                    width: 50% !important;
                    display: inline-block !important
                }

                #${customPrefix}-menu-list div.${customPrefix}-menu-item:hover {
                    background-color: #f0f0f0 !important;
                }
            `,
            "unique": true,
            "id": `${customPrefix}-createMenu-style`
        });

        await setElemDisplay(wrapper, "toggle");

        const menuAppearEvent = new Event(`${customPrefix}-menu-appear`);
        if (isMobile) {
            // document.addEventListener("dblclick", () => {
            //     ev.preventDefault();
            // }, true);
            nClicksListener(2, async (ev) => {
                _addAdhocItems();
                wrapper.querySelectorAll(`div.${customPrefix}-menu-item`).forEach((item) => item.dispatchEvent(menuAppearEvent));
                const _ = await setElemDisplay(wrapper, "toggle");
            }, ["A", "INPUT", "BUTTON", "IMG"], true);
        } else {
            document.addEventListener("keydown", async function(ev) {
                if (ev.keyCode == 48 && ev.ctrlKey) {   // 48 = "0"
                    _addAdhocItems();
                    wrapper.querySelectorAll(`div.${customPrefix}-menu-item`).forEach((item) => item.dispatchEvent(menuAppearEvent));
                    const isHidden = await setElemDisplay(wrapper, "toggle");
                    if (isHidden) {
                        document.getElementById(`${customPrefix}-menu-input`).focus();
                    }
                }
            }, true);
        }
        return wrapper;
    }

    function _registerItems(handlers, parent, nested=false) {
        const nonEmpty = parent.children.length > 0;
        if (!nested && nonEmpty) {
            let divider = document.createElement("hr");
            parent.appendChild(divider);
        }

        for (const [key, value] of Object.entries(handlers)) {
            if (value === null || typeof value !== "object") {
                continue;
            }

            const handler = value["handler"] || null,
                  args = value["args"] || [],
                  needInput = value["needInput"] || false,
                  checker = value["checker"] || undefined;

            if (handler === null) {
                let item = document.createElement("div");
                item.className = `${customPrefix}-menu-row`;
                _registerItems(value, item, true);
                parent.appendChild(item);
                continue;
            }

            let item = document.createElement("div");
            item.className = `${customPrefix}-menu-item ${customPrefix}-${nested ? "half-width" : "menu-row"}`;
            item.innerText = key;

            item.addEventListener("click", () => {
                if (needInput) {
                    let input = document.getElementById(`${customPrefix}-menu-input`).value;
                    handler(input, ...args);
                } else {
                    handler(...args);
                }
                setElemDisplay(wrapper, "toggle");
            });

            item.addEventListener(`${customPrefix}-menu-appear`, () => {
                if (checker !== undefined) {
                    setElemDisplay(item, checker() === false ? "none" : (nested ? "inline-block" : "block"));
                }
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

    const wrapper = document.getElementById(`${customPrefix}-menu-wrapper`) || await _createWrapper(),
          list = document.getElementById(`${customPrefix}-menu-list`);

    _registerItems(handlerDict, list);
}

function openURL(template, args, term=null) {
    let targetUrl = window.location;
    let url = template.replaceAll("[hostname]", targetUrl.hostname)
                      .replaceAll("[origin]", targetUrl.origin)
                      .replaceAll("[href]", targetUrl.href)
                      .replaceAll("[encoded_href_once]", encodeURIComponent(targetUrl.href))
                      .replaceAll("[encoded_href_twice]", encodeURIComponent(encodeURIComponent(targetUrl.href)));
    if (term !== null) {
        url = url.replaceAll("[term]", term);
    }
    if ("replaceHostname" in args && args["replaceHostname"] === true && "newHostname" in args) {
        url = url.replace(targetUrl.hostname, args["newHostname"]);
    }
    if ("nativeNewTab" in args && args["nativeNewTab"] === true && typeof GM_openInTab === "function") {
       GM_openInTab(url, { active: true, insert: true }); 
    } else {
        window.open(url);
    }
}

// useExtensionAPI: for circumventing CORS restriction
async function downloadURLs(urls, handler, moreConfig={}, useExtensionAPI=false, ...params) {
    const config = { "method": "GET", ...moreConfig };
    async function _downloadURL(url, idx) {
        try {
            if (useExtensionAPI) {
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
        if (typeof GM.xmlHttpRequest === "function") {
            GM.xmlHttpRequest({
                ...config,
                "url": url,
                "onload": (response) => resolve(response),
                "onerror": (response) => reject(response.status),
                "ontimeout": (response) => reject(response.status),
            }).catch((err) => reject(err));
        } else {
            reject("GM.xmlHttpRequest is not exposed");
        }
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
