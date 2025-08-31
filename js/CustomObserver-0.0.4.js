class CustomObserver {
    constructor(root=null) {
        this.root = root || document;
    }
    
    static _CustomObserverChain = class {
        constructor() {
            this.observers = [];
            this.controller = null;
            this.signal = null;
        }
        
        addObserver(observer) {
            if (observer !== undefined) {
                this.observers.push(observer);
            }
        }

        addController(controller) {
            if (controller) {
                this.controller = controller;
                this.signal = controller.signal;
            }
        }

        addTimeoutHandler(handler) {
            if (this.signal !== null) {
                this.signal.addEventListener("abort", () => { handler(new Error("Aborted due to timeout")) });
            }
        }
        
        clearStates() {
            this.observers.forEach((observer) => { observer.disconnect() });
            if (this.controller) { this.controller.abort() };

            this.observers = [];
            this.controller = null;
            this.signal = null;
        }
    };

    /*
    parent: String || Element
        selector or an element
    childrenNeeded: { String : Function(Element) }
        Object that maps selector -> handler for the selected element
    */
    observeChild(parent, childrenNeeded, timeout=null) {
        const observer = this._observeChild(parent, childrenNeeded, false);
        if (timeout !== null && typeof timeout === "number" && timeout > 0) {
            setTimeout(() => { observer.disconnect() }, timeout);
        }
        
        return observer;
    }

    /*
    parent: String || Element
        selector or an element
    childrenNeeded: { String : Function(Element) }
        Object that maps selector -> handler for the selected element
    */
    observeChildContinuous(parent, childrenNeeded) {
        const observer = this._observeChild(parent, childrenNeeded, true);
        return observer;
    }

    /*
    elementChain: [String]
        array of selectors
    handler: Function(Element)
        handler for the last node in elementChain
    timeout: Integer
        in ms
    */
    async observeChain(elementChain, handler, timeout=null) {
        function _observeChildAsync(parent, child, observerChain) {
            return new Promise((resolve, reject) => {
                observerChain.addTimeoutHandler(reject);
                const childObserver = this.observeChild(parent, { [child]: resolve });
                observerChain.addObserver(childObserver);
            });
        }

        const observerChain = new CustomObserver._CustomObserverChain();
        
        if (timeout !== null && typeof timeout === "number" && timeout > 0) {
            const controller = new AbortController();
            observerChain.addController(controller);
            setTimeout(() => { observerChain.clearStates() }, timeout);
        }

        let parent = this.root.querySelector(elementChain[0]);
        for (let idx = 1; idx < elementChain.length; idx++) {
            let child = elementChain[idx];
            try {
                child = await _observeChildAsync.call(this, parent, child, observerChain);
            } catch(e) {
                console.log(e);
                break;
            }
            parent = child;
            if (idx === elementChain.length - 1) {
                handler(child);
            }
        }

        observerChain.clearStates();
    }

    /*
    ancestor: Element
        an element to observe
    descendentsNeeded: { String : Function(Element) }
        Object that maps selector -> handler for the selected element
    */
    observeDescendent(ancestor, descendentsNeeded, timeout=null) {
        function _checkDescendent() {
            for (const [selector, handler] of Object.entries(descendentsNeeded)) {
                const target = ancestor.querySelector(selector);
                if (target) {
                    delete descendentsNeeded[selector];
                    handler(target);
                }
            }
        }

        _checkDescendent();
        if (Object.keys(descendentsNeeded).length === 0) {
            return;
        }

        const observer = new window.MutationObserver(() => {
            _checkDescendent();
            if (Object.keys(descendentsNeeded).length === 0) {
                observer.disconnect();
                return;
            }
        });
        observer.observe(ancestor, {"childList": true, "subtree": true});
        
        if (timeout !== null && typeof timeout === "number" && timeout > 0) {
            setTimeout(() => { observer.disconnect() }, timeout);
        }
    }

    /* Run handler as soon as the ancestor has started populating
    ancestor: Element
        an element to observe
    handler: Function()
    */
    observeAnyDescendent(ancestor, handler, timeout=null) {
        function _checkAnyDescendent() {
            const target = ancestor.querySelector(anySelector);
            return target ? true : false;
        }

        const anySelector = "*";
        if (_checkAnyDescendent()) {
            handler();
            return;
        }

        const observer = new window.MutationObserver(() => {
            observer.disconnect();
            handler();
            // if (_checkAnyDescendent()) {
            //     observer.disconnect();
            //     handler();
            // }
        });
        observer.observe(ancestor, {"childList": true, "subtree": true});
        
        if (timeout !== null && typeof timeout === "number" && timeout > 0) {
            setTimeout(() => { observer.disconnect() }, timeout);
        }
    }

    _observeChild(parent, childrenNeeded, continuous) {
        function _checkChild(node) {
            if (!node || !(node instanceof Element)) {
                return;
            }
            for (const [selector, handler] of Object.entries(childrenNeeded)) {
                console.log(node, selector, node.matches(selector))
                if (node.matches(selector)) {
                    console.log("Found:" + selector)
                    if (!continuous) {
                        delete childrenNeeded[selector];
                    }
                    handler(node);
                }
            }
        }

        parent = typeof parent === "string"? this.root.querySelector(parent) : parent;
        if (!parent || !(parent instanceof Element)) {
            console.log("Failed to retrieve the parent element for: ", childrenNeeded);
        }

        if (!continuous) {
            for (const child of parent.children) {
                _checkChild(child);
                if (Object.keys(childrenNeeded).length === 0) {
                    return;
                }
            }
        }

        const observer = new window.MutationObserver((mutationRecords) => {
            for (let i = 0; i < mutationRecords.length; i++) {
                for (let j = 0; j < mutationRecords[i].addedNodes.length; j++) {
                    const addedNode = mutationRecords[i].addedNodes[j];
                    _checkChild(addedNode);
                    if (!continuous && Object.keys(childrenNeeded).length === 0) {
                        observer.disconnect();
                        return;                        
                    }
                }
            }
            // const addedNode = mutationRecords[0].addedNodes[0];
        });
        observer.observe(parent, {childList: true});
        
        return observer;
    }
} 