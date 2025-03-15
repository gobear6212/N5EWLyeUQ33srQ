class EntriesBookmark {
    constructor(name, registerFn) {
        const customPrefix = "Whw9cPZ7";

        this.name = name;
        this.key = `SavedEntries.${this.name}`;
        this.entries = this.getEntries();
        // if (this.entries.size === 0)  throw `Empty ${this.key}`;

        this.customButtonClass = `${customPrefix}-blocker-button`;
        this.customButtonAllowClass = `${customPrefix}-blocker-button-allow`;
        this.customButtonForbidClass = `${customPrefix}-blocker-button-forbid`;
        this.customButtonGroupClass = `${customPrefix}-blocker-button-group`;

        this.options = Object.freeze({
            "b": ["Unblock", "Block"],   // blocked
            "h": ["Unhide", "Hide"],   // hidden
            "p": ["Unpin", "Pin"],   // pinned
        });

        this.buttonGroupProviderBinded = this.buttonGroupProvider.bind(this);
        this.clickHandlerBinded = this.clickHandler.bind(this);
        this.findExistingEntryBinded = this.findExistingEntry.bind(this);

        /*
            this.buttonGroupProvider is usually used on a page describing a specific entry
            this.findExistingEntry is usually used on a page listing some/all of the entries
        */
        registerFn(this.buttonGroupProviderBinded, this.findExistingEntryBinded);

        this.registerStyle();
    }

    buttonGroupProvider(name) {
        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add(this.customButtonGroupClass);

        const [existingEntry, _] = this.findExistingEntry(name);
        for (const [key, value] of Object.entries(this.options)) {
            const entryValue = this.getLabel(name, key);
            const entryExists = existingEntry === entryValue;

            const button = document.createElement("div");
            button.innerText = entryExists? value[0] : value[1];
            button.classList.add(this.customButtonClass);
            button.classList.add(entryExists ? this.customButtonForbidClass : this.customButtonAllowClass);
            button.dataset.actionKey = key;
            button.dataset.actionPut = value[1];
            button.dataset.actionDel = value[0];
            button.dataset.entryValue = entryValue;
            buttonGroup.appendChild(button);
        }
        buttonGroup.dataset.name = name;

        buttonGroup.addEventListener("click", this.clickHandlerBinded)
        return buttonGroup;
    }

    clickHandler(ev) {
        const isButton = () => ev.target.classList.contains(this.customButtonClass);
        const isButtonGroup = () => ev.currentTarget.classList.contains(this.customButtonGroupClass);
        if (!isButton() || !isButtonGroup()) {
            return;
        }

        const clickedButton = ev.target;
        const buttonGroup = ev.currentTarget;

        const action = clickedButton.innerText;
        const actionKey = clickedButton.dataset.actionKey;
        const entryValue = clickedButton.dataset.entryValue;
        const toAdd = clickedButton.classList.contains(this.customButtonAllowClass);
        const name = buttonGroup.dataset.name;

        const confirmed = confirm(`${action} ${name}?`);
        if (confirmed) {
            this.entries = this.getEntries();   // fetch the latest entries when a write is to be performed
            let [existingEntry, _] = this.findExistingEntry(name);

            if (toAdd && existingEntry !== entryValue) {
                this.entries.add(entryValue);
                if (existingEntry !== null) {
                    this.entries.delete(existingEntry);
                }
                existingEntry = entryValue;
            } else if (!toAdd && existingEntry === entryValue) {
                this.entries.delete(entryValue);
                existingEntry = null;
            }
            this.setEntries(this.entries);

            for (const _button of buttonGroup.children) {
                const _entryValue = _button.dataset.entryValue;
                if (_entryValue !== existingEntry) {
                    _button.classList.add(this.customButtonAllowClass);
                    _button.classList.remove(this.customButtonForbidClass);
                    _button.innerText = _button.dataset.actionPut;
                } else {
                    _button.classList.add(this.customButtonForbidClass);
                    _button.classList.remove(this.customButtonAllowClass);
                    _button.innerText = _button.dataset.actionDel;
                }
            }
        }
    }

    getEntries() {
        return new Set(GM_getValue(this.key, []));
    }

    setEntries(entries) {
        GM_setValue(this.key, Array.from(entries));
    }

    findExistingEntry(name) {
        let existingEntry = null;
        let actionKey = null;
        for (const key of Object.keys(this.options)) {
            const entryValue = this.getLabel(name, key);
            if (this.entries.has(entryValue)) {
                existingEntry = entryValue;
                actionKey = key;
                break;
            }
        }
        return [existingEntry, actionKey];
    }

    getLabel(name, actionKey) {
        return `${name}|${actionKey}`;
    }

    insertStylesheet(str, id, doc=document) {
        const stylesheet = doc.createElement("style");
        stylesheet.innerText = str;
        stylesheet.id = id;
        (doc.head || doc.body || doc.documentElement).appendChild(stylesheet);
    }

    registerStyle() {
        this.insertStylesheet(`
            .${this.customButtonGroupClass} {
                all: revert;
                position: relative;
                display: inline-flex;
                vertical-align: middle;
            }

            .${this.customButtonGroupClass} > *:not(:last-child) {
                border-top-right-radius: 0;
                border-bottom-right-radius: 0;
            }

            .${this.customButtonGroupClass} > *:not(:first-child) {
                border-top-left-radius: 0;
                border-bottom-left-radius: 0;
            }

            .${this.customButtonClass} {
                display: block;
                color: #fff;
                text-align: center;
                cursor: pointer;
                background-color: #6c757d;
                border: 1px solid transparent;
                padding: .375rem .75rem;
                font-size: 1rem;
                border-radius: .25rem;
                margin-bottom: 0.5rem;
            }

            .${this.customButtonClass}.${this.customButtonAllowClass} {
                background-color: #0d6efd;
            }

            .${this.customButtonClass}.${this.customButtonForbidClass} {
                background-color: #dc3545;
            }
        `, `${customPrefix}-blocker-style`);
    }
}
