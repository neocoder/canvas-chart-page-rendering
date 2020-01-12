import bsb from "binary-search-bounds";
import EventEmitter from 'events';

const syncScroll = new EventEmitter();

const SD_DOWN = 'SD_DOWN';
const SD_UP = 'SD_UP';

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

/// expand with color, background etc.
function drawTextBG(ctx, txt, font, x, y) {
	ctx.save();
	ctx.font = font;
	ctx.textBaseline = 'top';

	/// color for background
	ctx.fillStyle = '#f50';
	var width = ctx.measureText(txt).width;

	/// draw background rect
	ctx.fillRect(x, y, width, parseInt(font, 10));

	/// text color
	ctx.fillStyle = '#000';
	ctx.fillText(txt, x, y);

	ctx.restore();
}

class InfiniteChart {
	constructor(width = 300, height = 400) {
		this.width = width;
		this.height = height;
		this.masterCanvasHeight = height * 2;
		this.lastRenderPos = 0;

		this.dpr = window.devicePixelRatio || 1;

		this.maxYPoint = 110000;

		this.currentPage = 0;

		this.pageTop = 0;
		this.pageBottom = 1;

		this.scrollDirection = null;

		this.currentRangeFrom = 0;
		this.currentRangeTo = this.height;

		this.imageDataCache = {
			bottom: null,
			top: null, // { range: [0, 3000], imageData: }
			next: null,
		};

		this.currentPageImgData = null;
		this.prevPageImgData = null;

		this.drawFrame = this.drawFrame.bind(this);

		const rootEl = document.createElement('div');

		const cvdebug = this.createCanvasElement(300, 100);
		rootEl.appendChild(cvdebug);
		this.ctxDebug = cvdebug.getContext('2d');

		const canvas = this.createCanvasElement(this.width, this.masterCanvasHeight);
		this.ctx = canvas.getContext('2d');
		// this.ctx2 = this.createCanvas('bottom');

		const scrollBox = document.createElement('div');
		scrollBox.className = 'scrollbox';
		scrollBox.innerHTML = `
			<div class="scrollContainer" style="height: ${this.maxYPoint}px;">
			</div>
		`;
		this.miniCanvas = this.createCanvasElement(width, height);
		scrollBox.querySelector('.scrollContainer').appendChild(this.miniCanvas);
		rootEl.appendChild(scrollBox);
		document.querySelector('#canvases').appendChild(rootEl);
		this.miniCtx = this.miniCanvas.getContext("2d");

		scrollBox.addEventListener('scroll', e => {
			syncScroll.emit('scroll', Math.round(scrollBox.scrollTop));
			// this.handleScroll(Math.round(scrollBox.scrollTop));
		});

		syncScroll.on('scroll', scrollPos => {
			this.handleScroll(scrollPos);
		})

		this.initChart();
	}

	createCanvasElement(width, height) {
		const { dpr } = this;
		const canvas = document.createElement('canvas');
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		const ctx = canvas.getContext('2d');
		ctx.scale(dpr, dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		return canvas;
	}

	getRangeIntersection(range, imageDataCache, relative = false) {
		const idcRange = imageDataCache.range;

		const min = range.from < idcRange.from ? range : idcRange;
		const max = min == range ? idcRange : range;

		if ( min.to < max.from ) { // min ends before max starts -> no intersection
			return null;
		}

		return relative ? {
			from: max.from - idcRange.from,
			to: (min.to < max.to ? min.to : max.to) - idcRange.from
		}
		 : {
			from: max.from,
			to: min.to < max.to ? min.to : max.to
		}
    // return range(max.start , (min.end < max.end ? min.end : max.end))
	}

	rangeToXYWH({from, to}) {
		return {
			x: 0,
			y: from * this.dpr,
			w: this.width * this.dpr,
			h: (to - from) * this.dpr
		}
	}

	renderDebug(data) {
		const ctx = this.ctxDebug;
		const rowHeight = 16;
		const colWidth = this.width;
		const maxRows = 5;
		const maxCols = 1;
		let curCol = 0;
		let curRow = 0;
		ctx.clearRect(0, 0, colWidth, 100);
		ctx.font = '14px sans-serif';
		Object.entries(data).forEach(([key, value]) => {

			ctx.fillStyle = '#000';
			ctx.textBaseline = 'top';
			const x = curCol * colWidth;
			const y = curRow * rowHeight;

			ctx.fillText(`${key}: ${value}`, x, y);

			curRow += 1;

			if ( curRow >= maxRows ) {
				curRow = 0;
				curCol += 1;
			}
		});

	}

	handleScroll(scrollTop) {
		const scrollDirection = ( scrollTop >= this.currentRangeFrom ) ? SD_DOWN : SD_UP;

		this.currentRangeFrom = scrollTop;
		this.currentRangeTo = this.currentRangeFrom + this.height;

		const pageFrom = Math.floor(this.currentRangeFrom / this.masterCanvasHeight);
		const pageTo = pageFrom + 1;

		const prevImageDataCacheTop = this.imageDataCache.top;
		const prevImageDataCacheBottom = this.imageDataCache.bottom;

		this.imageDataCache.top = null;
		this.imageDataCache.bottom = null;

		if ( prevImageDataCacheTop.page === pageFrom ) {
			this.imageDataCache.top = prevImageDataCacheTop;
		} else if ( prevImageDataCacheBottom.page === pageFrom ) {
			this.imageDataCache.top = prevImageDataCacheBottom;
		}

		if ( prevImageDataCacheTop.page === pageTo ) {
			this.imageDataCache.bottom = prevImageDataCacheTop;
		} else if ( prevImageDataCacheBottom.page === pageTo ) {
			this.imageDataCache.bottom = prevImageDataCacheBottom;
		}

		if ( !this.imageDataCache.top ) {
			// console.warn('Top page redraw');
			this.imageDataCache.top = this.drawFrame(pageFrom);
		}

		if ( !this.imageDataCache.bottom ) {
			// console.warn('Bottom page redraw');
			this.imageDataCache.bottom = this.drawFrame(pageTo);
		}

		// can be removed
		const topRange = this.imageDataCache.top && this.getRangeIntersection({
			from: this.currentRangeFrom,
			to: this.currentRangeTo
		}, this.imageDataCache.top, true);

		const bottomRange = this.imageDataCache.bottom && this.getRangeIntersection({
			from: this.currentRangeFrom,
			to: this.currentRangeTo
		}, this.imageDataCache.bottom, true);

		this.miniCtx.clearRect(0, 0, this.width, this.height);

		let lastDrawPos = 0;
		if ( topRange ) {
			const { x, y, w, h } = this.rangeToXYWH(topRange);
			lastDrawPos = h;
			this.miniCtx.putImageData(this.imageDataCache.top.imageData,
				0, -y, x, y, w, h);
		}


		if ( bottomRange ) {
			const { x, y, w, h } = this.rangeToXYWH(bottomRange);
			if ( lastDrawPos === 0 ) {
				lastDrawPos = -y;
			}
			this.miniCtx.putImageData(this.imageDataCache.bottom.imageData,
				0, lastDrawPos, x, y, w, h);
		}

		this.renderDebug({
			'currentRangeFrom': this.currentRangeFrom,
			'currentRangeTo': this.currentRangeTo,
			'pageFrom': pageFrom,
			'pageTo': pageTo,
		});


		// this.imageDataCache.top && this.ctx.putImageData(this.imageDataCache.top.imageData, 0, 0);
		// this.imageDataCache.bottom && this.ctx2.putImageData(this.imageDataCache.bottom.imageData, 0, 0);

		this.scrollDirection = scrollDirection;
	}

	initChart() {
		this.dataItems = [];
		for (let i = 0; i < this.maxYPoint; i++) {
			this.dataItems.push({
				point: {
					x: getRandomInt(0, 250),
					y: i
				},
				n: i
			});
		}

		this.imageDataCache.top = this.drawFrame(this.currentPage);
		this.imageDataCache.bottom = this.drawFrame(this.currentPage + 1);
		this.handleScroll(0);
	}

	drawDebugData(page) {
		const { ctx } = this;

		/// draw page number
		ctx.save();
		const font = "102px sans-serif";
		const fontHeight = parseInt(font, 10);
		ctx.font = font;
		ctx.textBaseline = 'top';
		let textWidth = ctx.measureText(page).width;
		let x = Math.round(this.width / 2 - textWidth / 2);
		let y = Math.round(this.masterCanvasHeight / 2 - fontHeight / 2);
		ctx.fillStyle = '#000';
		ctx.fillText(page, x, y);
		ctx.restore();
	}

	drawFrame(page) {
		const { ctx } = this;
		const canvasHeight = this.masterCanvasHeight;
		const canvasWidth = this.width;

		ctx.fillStyle = "rgba(228, 248, 225, 0.5)";

		const pagePointsRangeFrom = page * this.masterCanvasHeight;
		const pagePointsRangeTo = pagePointsRangeFrom + this.masterCanvasHeight;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		const firstPoint = bsb.ge(this.dataItems, pagePointsRangeFrom, ({ point: { x, y } }, from) => y - from);
		const lastPoint = bsb.le(this.dataItems, pagePointsRangeTo, ({ point: { x, y } }, to) => y - to);
		let newItems = this.dataItems.slice(firstPoint, lastPoint+1)

		this.drawDebugData(page);

		if (newItems.length) {
			ctx.save();
			ctx.translate(0, -pagePointsRangeFrom);

			ctx.font = "12px sans-serif";

			let prev = null;

			newItems.forEach(itm => {
				const { x, y } = itm.point;

				if (prev) {
					ctx.beginPath();
					ctx.strokeStyle = "blue";

					ctx.moveTo(prev.point.x, prev.point.y);
					ctx.lineTo(x, y);
					ctx.stroke();
				}

				prev = itm;
			});

			// draw labels
			newItems.forEach(itm => {
				const { y } = itm.point;

				if ( itm.n % 20 === 0 ) {
					drawTextBG(ctx, itm.n, "12px sans-serif", 10, y + 3)
				}

			});

			ctx.restore();
		}

		const pageRangeFrom = page * this.masterCanvasHeight;
		const pageRangeTo = pageRangeFrom + this.masterCanvasHeight;

		return  {
			range: { from: pageRangeFrom, to: pageRangeTo },
			page,
			imageData: ctx.getImageData(0, 0, this.width * this.dpr, this.masterCanvasHeight * this.dpr)
		}
	}
}

function createCharts(chartsNum) {
	for (let i = 0; i < chartsNum; i++) {
		new InfiniteChart();
	}
}

createCharts(5)
