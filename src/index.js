import bsb from "binary-search-bounds";

let globalScroll = 0;

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

class InfiniteChart {
	constructor(width = 300, height = 300) {
		this.width = width;
		this.height = height;

		this.drawFrame = this.drawFrame.bind(this);

		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height * 2;

		this.ctx = this.canvas.getContext('2d');

		const wrap = document.createElement('div');
		wrap.appendChild(this.canvas);
		document.body.appendChild(wrap);

		const scrollBox = document.createElement('div');
		scrollBox.className = 'scrollbox';
		scrollBox.innerHTML = `
			<div>
				<canvas
					width="300"
					height="300"
				></canvas>
			</div>
		`;
		document.body.appendChild(scrollBox);
		this.miniCanvas = scrollBox.querySelector('canvas');
		this.miniCtx = this.miniCanvas.getContext("2d");

		scrollBox.addEventListener('scroll', e => {
			globalScroll = Math.round(scrollBox.scrollTop);
		});

		this.initChart();
	}

	initChart() {
		this.dataItems = [];
		for (let i = 0; i < 80000; i++) {
			this.dataItems.push({
				point: {
					x: getRandomInt(0, 250),
					y: i / 4
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

	drawFrame() {
		const { canvas, ctx } = this;
		const canvasHeight = canvas.height;
		const canvasWidth = canvas.width;

		let perfMin = 0;
		let perfMax = 0;

		ctx.fillStyle = "rgba(228, 248, 225, 0.5)";

		const scroll = globalScroll;
		let pointsRangeFrom = scroll;
		let pointsRangeTo = scroll + canvasHeight;

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

		const firstPoint = bsb.ge(this.dataItems, pointsRangeFrom, ({ point: { x, y } }, from) => y - from);
		const lastPoint = bsb.le(this.dataItems, pointsRangeTo, ({ point: { x, y } }, to) => y - to);
		let newItems = this.dataItems.slice(firstPoint, lastPoint+1)

		let t2 = (performance.now() - t).toFixed(4);

		if ( t2 > perfMax ) {
			perfMax = t2;
		} else if ( t2 < perfMin ) {
			perfMin = t2
		}

		let perfAvg = (perfMin + perfMax) / 2;

		ctx.fillStyle = "black";
		ctx.rect(248, 0, 70, 150);
		ctx.fill();

		ctx.fillStyle = "red";
		ctx.fillText(`scroll: ${scroll}`, 250, 15);

		ctx.fillStyle = "green";
		ctx.fillText(`${newItems.length} items`, 250, 30);

		ctx.fillStyle = "yellow";
		ctx.fillText(`${t2} ms`, 250, 45);

		ctx.fillStyle = "magenta";
		ctx.fillText(`from: ${newItems[0].n}`, 250, 60);

		ctx.fillStyle = "cyan";
		ctx.fillText(`to: ${newItems[newItems.length - 1].n}`, 250, 75);

		ctx.fillStyle = "white";
		ctx.fillText(`${perfMin}`, 250, 90);

		ctx.fillStyle = "white";
		ctx.fillText(`${perfMax}`, 250, 105);

		ctx.fillStyle = "white";
		ctx.fillText(`${perfAvg}`, 250, 120);


		if (newItems.length) {
			ctx.save();
			ctx.translate(0, -scroll);

			ctx.font = "12px sans-serif";

			let prev = null;

			newItems.forEach(itm => {
				const { x, y } = itm.point;
				// ctx.fillStyle = "#000";
				// ctx.fillText(itm.n, x + 15, y + 3);

				if (prev) {
					ctx.beginPath();
					ctx.strokeStyle = "blue";

					ctx.moveTo(prev.point.x, prev.point.y);
					ctx.lineTo(x, y);
					ctx.stroke();
				}

				// ctx.beginPath();
				// ctx.arc(x, y, 5, 0, Math.PI * 2);
				// ctx.fill();
				// ctx.stroke();
				prev = itm;
			});
			ctx.restore();
		}

		ctx.getImageData(0, 0, this.width, this.height);
		this.miniCtx.putImageData(ctx.getImageData(0, 0, this.width, this.height), 0, 0);

		requestAnimationFrame(this.drawFrame);
	}
}

function createCharts(chartsNum) {
	for (let i = 0; i < chartsNum; i++) {
		new InfiniteChart();
	}
}

createCharts(1)
