import bsb from "binary-search-bounds";

let globalScroll = 0;

const SD_DOWN = 'SD_DOWN';
const SD_UP = 'SD_UP';

const pagesColors = [
	'#cee7e6',
	'#bfc0c0',
	'#648767',
	'#7dc95e',
	'#7cdf64',
	'#d4e09b',
	'#94a89a',
	'#c7ac92',
	'#a44a3f',
]

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

/// expand with color, background etc.
function drawTextBG(ctx, txt, font, x, y) {

	/// lets save current state as we make a lot of changes
	ctx.save();

	/// set font
	ctx.font = font;

	/// draw text from top - makes life easier at the moment
	ctx.textBaseline = 'top';

	/// color for background
	ctx.fillStyle = '#f50';

	/// get width of text
	var width = ctx.measureText(txt).width;

	/// draw background rect assuming height of font
	ctx.fillRect(x, y, width, parseInt(font, 10));

	/// text color
	ctx.fillStyle = '#000';

	/// draw text on top
	ctx.fillText(txt, x, y);

	/// restore original state
	ctx.restore();
}

class InfiniteChart {
	constructor(width = 300, height = 300) {
		this.width = width;
		this.height = height;
		this.masterCanvasHeight = height * 2;
		this.lastRenderPos = 0;

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

		const cvdebug = document.querySelector('#cvdebug');
		this.ctxDebug = cvdebug.getContext('2d');

		this.ctx = this.createCanvas('top');
		this.ctx2 = this.createCanvas('bottom');

		const scrollBox = document.createElement('div');
		scrollBox.className = 'scrollbox';
		scrollBox.innerHTML = `
			<div style="height: ${this.maxYPoint}px;">
				<canvas
					width="${width}"
					height="${height}"
				></canvas>
			</div>
		`;
		document.querySelector('#canvases').appendChild(scrollBox);
		this.miniCanvas = scrollBox.querySelector('canvas');
		this.miniCtx = this.miniCanvas.getContext("2d");

		scrollBox.addEventListener('scroll', e => {
			this.handleScroll(Math.round(scrollBox.scrollTop));
		});

		this.initChart();
	}

	createCanvas(title = '') {
		const canvas = document.createElement('canvas');
		canvas.width = this.width;
		canvas.height = this.masterCanvasHeight;

		const div = document.createElement('div');
		div.innerHTML = `<span>${title}</span>`;
 		div.appendChild(canvas);

		document.querySelector('#canvases').appendChild(div);
		return canvas.getContext('2d');
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
			y: from,
			w: this.width,
			h: to - from
		}
	}

	renderDebug(data) {
		const ctx = this.ctxDebug;
		const rowHeight = 16;
		const colWidth = 250;
		const maxRows = 5;
		const maxCols = 2;
		let curCol = 0;
		let curRow = 0;
		ctx.clearRect(0, 0, 500, 100);
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
			console.warn('Top page redraw');
			this.imageDataCache.top = this.drawFrame(pageFrom);
		}

		if ( !this.imageDataCache.bottom ) {
			console.warn('Bottom page redraw');
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


		this.renderDebug({
			'currentRangeFrom': this.currentRangeFrom,
			'currentRangeTo': this.currentRangeTo,
			'pageFrom': pageFrom,
			'pageTo': pageTo,
		});

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

		this.imageDataCache.top && this.ctx.putImageData(this.imageDataCache.top.imageData, 0, 0);
		this.imageDataCache.bottom && this.ctx2.putImageData(this.imageDataCache.bottom.imageData, 0, 0);

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

		// data.forEach(([x, y]) => {
		//   ctx.beginPath();
		//   ctx.arc(x, y, 3, 0, Math.PI * 2);
		//   ctx.fill();
		//   ctx.stroke();
		// });

		this.imageDataCache.top = this.drawFrame(this.currentPage);
		this.imageDataCache.bottom = this.drawFrame(this.currentPage + 1);
		this.handleScroll(0);

		// requestAnimationFrame(this.drawFrame);
	}

	drawDebugData(page) {
		const {
			currentRangeFrom,
			currentRangeTo,
			scrollDirection,
			ctx
		} = this;

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
		const { canvas, ctx } = this;
		const canvasHeight = this.masterCanvasHeight;
		const canvasWidth = this.width;

		let perfMin = 0;
		let perfMax = 0;

		ctx.fillStyle = "rgba(228, 248, 225, 0.5)";

		// const scroll = globalScroll;

		const pagePointsRangeFrom = page * this.masterCanvasHeight;
		const pagePointsRangeTo = pagePointsRangeFrom + this.masterCanvasHeight;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		// let newItems = [];
		// for (let i = 0; i < dataItems.length; i++) {
		//   const { point, n } = dataItems[i];
		//   const { x, y } = point;

		//   if (y >= pointsRangeFrom && y <= pointsRangeTo) {
		//     newItems.push(dataItems[i]);
		//   } else if (y > pointsRangeTo) {
		//     break;
		//   }
		// }

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
			imageData: ctx.getImageData(0, 0, this.width, this.masterCanvasHeight)
		}
	}
}

function createCharts(chartsNum) {
	for (let i = 0; i < chartsNum; i++) {
		new InfiniteChart();
	}
}

createCharts(1)
