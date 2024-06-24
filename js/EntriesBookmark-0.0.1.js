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

        registerFn(this.buttonGroupProviderBinded, this.findExistingEntryBinded);

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
        buttonGroup.dataset.existingEntry = existingEntry;

        buttonGroup.addEventListener("click", this.clickHandlerBinded)
        return buttonGroup;
    }

    clickHandler(ev) {
        const isButton = () => ev.target.classList.contains(this.customButtonClass);
        const isButtonGroup = () => ev.currentTarget.classList.contains(this.customButtonGroupClass);
        if (!isButton() || !isButtonGroup()) {
            return;
        }

        const action = ev.target.innerText;
        const actionKey = ev.target.dataset.actionKey;
        const entryValue = ev.target.dataset.entryValue;
        const name = ev.currentTarget.dataset.name;
        const existingEntry = ev.currentTarget.dataset.existingEntry;

        const confirmed = confirm(`${action} ${name}?`);
        if (confirmed) {
            if (existingEntry !== "null") {
                this.entries.delete(existingEntry);
                ev.currentTarget.dataset.existingEntry = null;

                const selectedElem = ev.currentTarget.querySelector(`div.${this.customButtonForbidClass}`);
                if (selectedElem) {
                    selectedElem.classList.add(this.customButtonAllowClass);
                    selectedElem.classList.remove(this.customButtonForbidClass);
                    selectedElem.innerText = selectedElem.dataset.actionPut;
                }
            }
            if (existingEntry !== entryValue) {
                this.entries.add(entryValue);
                ev.currentTarget.dataset.existingEntry = entryValue;

                ev.target.classList.add(this.customButtonForbidClass);
                ev.target.classList.remove(this.customButtonAllowClass);
            }

            // in case there're new entries from other tabs
            const latestEntries = this.getEntries();
            latestEntries.delete(entryValue);
            latestEntries.delete(existingEntry);
            this.entries = this.setsUnion(this.entries, latestEntries);
            this.setEntries();

            const value = this.options[actionKey];
            ev.target.innerText = this.entries.has(entryValue)? value[0] : value[1];
        }
    }

    getEntries() {
        return new Set(GM_getValue(this.key, []));
    }

    setEntries(entries) {
        GM_setValue(this.key, Array.from(this.entries));
    }

    toggleEntry(entry) {
        if (this.entries.has(entry)) {
            this.entries.delete(entry);
        } else {
            this.entries.add(entry);
        }
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

    setsUnion(setA, setB) {
      const _union = new Set(setA);
      for (const elem of setB) {
        _union.add(elem);
      }
      return _union;
    }

    insertStylesheet(str, id, doc=document) {
        const stylesheet = doc.createElement("style");
        stylesheet.innerText = str;
        stylesheet.id = id;
        (doc.head || doc.body || doc.documentElement).appendChild(stylesheet);
    }
}
