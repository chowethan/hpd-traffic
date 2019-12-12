export default class Tooltip {
	constructor(element) {
		this._element = element;
		this._text = null;
		this._tooltip = null;
		this._hover = null;

		this.onEnter = this.onEnter.bind(this);
		this.onMove = this.onMove.bind(this);
		this.onLeave = this.onLeave.bind(this);

		this._mouseoverListener = element.addEventListener('mouseover', this.onEnter);
		this._mousemoveListener = element.addEventListener('mousemove', this.onMove);
		this._mouseleaveListener = element.addEventListener('mouseleave', this.onLeave);
	}

	setText(text) {
		this._text = typeof text == 'string' ? text : null;

		if (this._tooltip && this._text === null) {
			this.removeTooltip();
		} else if (this._tooltip) {
			this._tooltip.innerHTML = text;
		} else if (this._hover) {
			this.createTooltip(this._hover);
		}
	}

	createTooltip(event) {
		if (this._text !== null && !this._tooltip) {
			this._tooltip = document.createElement('div');
			this._tooltip.className = 'tooltip';
			this._tooltip.innerHTML = this._text;
			this._tooltip.style.top = `${event.clientY + 5}px`;
			this._tooltip.style.left = `${event.clientX}px`;
			document.body.appendChild(this._tooltip);
		}
	}

	removeTooltip() {
		document.body.removeChild(this._tooltip);
		this._tooltip = null;
	}

	onEnter(event) {
		this._hover = {clientX: event.clientX, clientY: event.clientY};
		this.createTooltip(event);
	}

	onMove(event) {
		this._hover = {clientX: event.clientX, clientY: event.clientY};

		if (this._tooltip) {
			this._tooltip.style.top = `${event.clientY + 10}px`;
			this._tooltip.style.left = `${event.clientX + 10}px`;
		}
	}

	onLeave() {
		this._hover = null;

		if (this._tooltip) {
			this.removeTooltip();
		}
	}

	destroy() {
		if (this._tooltip) {
			this.removeTooltip();
		}

		this._element.removeEventListener('mouseover', this.onEnter);
		this._element.removeEventListener('mousemove', this.onMove);
		this._element.removeEventListener('mouseleave', this.onLeave);
	}
}
