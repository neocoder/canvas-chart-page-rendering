import bsb from "binary-search-bounds";

let globalScroll = 0;

const SD_DOWN = 'SD_DOWN';
const SD_UP = 'SD_UP';

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
		this.currentPage = 0;

		this.scrollDirection = null;

		this.currentRangeFrom = 0;
		this.currentRangeTo = this.height;

		this.imageDataCache = {
			prev: null,
			cur: null, // { range: [0, 3000], imageData: }
			next: null,
		};

		this.currentPageImgData = null;
		this.prevPageImgData = null;

		this.drawFrame = this.drawFrame.bind(this);

		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = this.masterCanvasHeight;
		this.ctx = this.canvas.getContext('2d');
		document.body.appendChild(this.canvas);

		this.canvas2 = document.createElement('canvas');
		this.canvas2.width = width;
		this.canvas2.height = this.masterCanvasHeight;
		this.ctx2 = this.canvas2.getContext('2d');
		document.body.appendChild(this.canvas2);


		const scrollBox = document.createElement('div');
		scrollBox.className = 'scrollbox';
		scrollBox.innerHTML = `
			<div>
				<canvas
					width="${width}"
					height="${height}"
				></canvas>
			</div>
		`;
		document.body.appendChild(scrollBox);
		this.miniCanvas = scrollBox.querySelector('canvas');
		this.miniCtx = this.miniCanvas.getContext("2d");

		scrollBox.addEventListener('scroll', e => {
			this.handleScroll(Math.round(scrollBox.scrollTop));
		});

		this.initChart();
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

	handleScroll(scrollTop) {

		if ( scrollTop >= this.currentRangeFrom ) {
			this.scrollDirection = SD_DOWN;
		} else {
			this.scrollDirection = SD_UP;
		}

		this.currentRangeFrom = scrollTop;
		this.currentRangeTo = this.currentRangeFrom + this.height;

		const { currentPageImgData } = this;
		const relativeScrollTop = scrollTop - ( this.currentPage * this.masterCanvasHeight );
		// const scrollFrameTop = relativeScrollTop;
		const relativeScrollBottom = relativeScrollTop + this.height;

		this.drawFrame();

		console.log(`relativeScrollTop: ${relativeScrollTop}`);
		console.log(`relativeScrollBottom: ${relativeScrollBottom}`);

		// console.log(`relativeScrollBottom: ${relativeScrollBottom}`);
		// console.log(`this.masterCanvasHeight: ${this.masterCanvasHeight}`);
		if ( relativeScrollBottom > this.masterCanvasHeight ) {
			// console.warn('next page')
			this.imageDataCache.prev = this.imageDataCache.cur;
			this.currentPage += 1;
			// this.lastRenderPos = relativeScrollBottom;

			this.drawFrame();

		} else if ( relativeScrollBottom <= 0 ) {
			this.currentPage -= 1;
			this.imageDataCache.prev = this.imageDataCache.cur;
			this.drawFrame();
		}

		if ( this.imageDataCache.prev ) {
			this.miniCtx.clearRect(0, 0, this.width, this.height);

			console.warn('this.currentScrollRange: ', { from: this.currentRangeFrom, to: this.currentRangeTo } );
			console.log('this.currentRange: ', this.imageDataCache.cur.range );
			console.log('this.prevRAnge: ', this.imageDataCache.prev.range );

			const prevRange = this.getRangeIntersection({
				from: this.currentRangeFrom,
				to: this.currentRangeTo
			}, this.imageDataCache.prev, true);

			const curRange = this.getRangeIntersection({
				from: this.currentRangeFrom,
				to: this.currentRangeTo
			}, this.imageDataCache.cur, true);

			console.log('prevRangeIntersection:', prevRange);

			console.log('curRangeIntersection:', curRange)

			if ( prevRange ) {
				this.miniCtx.putImageData(
					this.imageDataCache.prev.imageData,
					0, -prevRange.from, //-(this.masterCanvasHeight-this.height)-relativeScrollTop,
					0, prevRange.from,
					this.width, prevRange.to-prevRange.from);
					console.log('putImageData prev: ', 0, prevRange.from, this.width, prevRange.to-prevRange.from)
			}


			// this.miniCtx.fillStyle = '#f50';
			// // this.miniCtx.fillRect(0, prevRange.to-this.height, this.width, curRange.to);
			// this.miniCtx.fillRect(0, prevRange.to-prevRange.from, this.width, curRange.to);
			// console.log('fillRect:' , 0, prevRange.to-prevRange.from, this.width, curRange.to)

				if ( curRange ) {
					if ( prevRange ) {
						this.miniCtx.putImageData(
							this.imageDataCache.cur.imageData,
							0, prevRange.to-prevRange.from,
							0, curRange.from,
							this.width, curRange.to);
					} else {
						this.miniCtx.putImageData(this.imageDataCache.cur.imageData, 0, -relativeScrollTop);
					}
				}
		} else {
			this.miniCtx.putImageData(this.imageDataCache.cur.imageData, 0, -relativeScrollTop);

		}
	}

	drawFrameBoundaries() {
		const { ctx } = this;
		ctx.strokeStyle = "red";

		const top = this.currentRangeFrom;
		const bottom = this.currentRangeTo;

		ctx.beginPath();
		ctx.moveTo(0, top);
		ctx.lineTo(this.width, top);
		ctx.stroke();

		ctx.strokeStyle = "green";

		ctx.beginPath();
		ctx.moveTo(0, bottom);
		ctx.lineTo(this.width, bottom);
		ctx.stroke();
	}

	initChart() {
		this.dataItems = [];
		for (let i = 0; i < 80000; i++) {
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

		requestAnimationFrame(this.drawFrame);
	}

	drawDebugData() {
		const {
			currentRangeFrom,
			currentRangeTo,
			scrollDirection,
			ctx
		} = this;

		ctx.save();
		ctx.font = "14px sans-serif";

		//*
		ctx.fillStyle = "rgba(0,0,0,0.75)";
		ctx.rect(220, 0, 70, 150);
		ctx.fill();

		ctx.fillStyle = "red";
		ctx.fillText(`F: ${currentRangeFrom}`, 230, 15);
		ctx.fillText(`T: ${currentRangeTo}`, 230, 30);

		ctx.fillStyle = "yellow";
		ctx.fillText(`${scrollDirection}`, 230, 45);

		// ctx.fillStyle = "magenta";
		// ctx.fillText(`from: ${newItems[0].n}`, 250, 60);

		// ctx.fillStyle = "cyan";
		// ctx.fillText(`to: ${newItems[newItems.length - 1].n}`, 250, 75);

		// ctx.fillStyle = "white";
		// ctx.fillText(`${perfMin}`, 250, 90);

		// ctx.fillStyle = "white";
		// ctx.fillText(`${perfMax}`, 250, 105);

		// ctx.fillStyle = "white";
		// ctx.fillText(`${perfAvg}`, 250, 120);
		//*/
		ctx.restore();
	}

	drawFrame() {
		const { canvas, ctx, currentPage, currentRangeFrom, currentRangeTo } = this;
		const canvasHeight = canvas.height;
		const canvasWidth = canvas.width;

		let perfMin = 0;
		let perfMax = 0;

		ctx.fillStyle = "rgba(228, 248, 225, 0.5)";

		// const scroll = globalScroll;

		const pagePointsRangeFrom = currentPage * this.masterCanvasHeight;
		const pagePointsRangeTo = pagePointsRangeFrom + this.masterCanvasHeight;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		let t = performance.now();

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

		let t2 = (performance.now() - t).toFixed(4);

		if ( t2 > perfMax ) {
			perfMax = t2;
		} else if ( t2 < perfMin ) {
			perfMin = t2
		}

		let perfAvg = (perfMin + perfMax) / 2;

		this.drawDebugData();

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

			// this.drawFrameBoundaries();

			ctx.restore();
		}

		const pageRangeFrom = this.currentPage * this.masterCanvasHeight;
		const pageRangeTo = pageRangeFrom + this.masterCanvasHeight;

		this.imageDataCache.cur = {
			range: { from: pageRangeFrom, to: pageRangeTo },
			imageData: ctx.getImageData(0, 0, this.width, this.masterCanvasHeight)
		};
		if ( this.imageDataCache.prev ) {
			this.ctx2.putImageData(this.imageDataCache.prev.imageData, 0, 0);
		}
		// requestAnimationFrame(this.drawFrame);
	}
}

function createCharts(chartsNum) {
	for (let i = 0; i < chartsNum; i++) {
		new InfiniteChart();
	}
}

createCharts(1)
