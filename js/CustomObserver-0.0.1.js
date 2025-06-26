class CustomObserver {
    constructor(root=null) {
        this.root = root || document;
        this.observers = [];
        this.controller = null;
        this.signal = null;
    }

    /*
    parent: String || Element
        selector or an element
    childrenNeeded: { String : Function(Element) }
        Object that maps selector -> handler for the selected element
    */
    observeChild(parent, childrenNeeded, timeout=null) {
        function _checkChild(node) {
            if (!node || !(node instanceof Element)) {
                return;
            }
            for (const [selector, handler] of Object.entries(childrenNeeded)) {
                console.log(node, selector, node.matches(selector))
                if (node.matches(selector)) {
                    console.log("Found:" + selector)
                    delete childrenNeeded[selector];
                    handler(node);
                }
            }
        }

        parent = typeof parent === "string"? this.root.querySelector(parent) : parent;
        if (!parent || !(parent instanceof Element)) {
            console.log("Failed to retrieve the parent element for: ", childrenNeeded);
        }
        for (const child of parent.children) {
            _checkChild(child);
            if (Object.keys(childrenNeeded).length === 0) {
                return;
            }
        }
        const observer = new window.MutationObserver((mutationRecords) => {
            for (let i = 0; i < mutationRecords.length; i++) {
                for (let j = 0; j < mutationRecords[i].addedNodes.length; j++) {
                    const addedNode = mutationRecords[i].addedNodes[j];
                    _checkChild(addedNode);
                    if (Object.keys(childrenNeeded).length === 0) {
                        observer.disconnect();
                        return;
                    }
                }
            }
            // const addedNode = mutationRecords[0].addedNodes[0];
        });
        this.observers.push(observer);
        observer.observe(parent, {childList: true});
        
        if (timeout !== null && typeof timeout === "number") {
            setTimeout(() => { observer.disconnect() }, timeout);
        }
    }

    observeChildAsync(parent, child) {
        return new Promise((resolve, reject) => {
            this.signal.addEventListener("abort", () => { reject(new Error("Aborted due to timeout")) });
            this.observeChild(parent, { [child]: resolve });
        });
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
        if (timeout !== null && typeof timeout === "number") {
            this.controller = new AbortController();
            this.signal = this.controller.signal;
            setTimeout(() => { this.clearObserversChain() }, timeout);
        }

        let parent = this.root.querySelector(elementChain[0]);
        for (let idx = 1; idx < elementChain.length; idx++) {
            let child = elementChain[idx];
            try {
                child = await this.observeChildAsync(parent, child);
            } catch(e) {
                console.log(e);
                break;
            }
            parent = child;
            if (idx === elementChain.length - 1) {
                handler(child);
            }
        }

        this.clearObserversChain();
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
                    handler(target);
                    delete descendentsNeeded[selector];
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
        
        if (timeout !== null && typeof timeout === "number") {
            setTimeout(() => { observer.disconnect() }, timeout);
        }
    }

    clearObserversChain() {
        this.observers.forEach((observer) => { observer.disconnect() });
        if (this.controller) { this.controller.abort() };
        this.clearStates();
    }

    clearStates() {
        this.observers = [];
        this.controller = null;
        this.signal = null;
    }
} 