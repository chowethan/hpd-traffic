const application = require('express');
const router = application.Router();
const http = require('http');
const parse = require('node-html-parser').parse;

const FREEWAY_NAMES = {
	MF: 'Moanalua',
	H1: 'H1',
	H2: 'H2',
	H3: 'H3',
};
const FREEWAY_DIRECTIONS = {
	N: 'North',
	E: 'East',
	W: 'West',
	S: 'South',
};
const FREEWAY_PARTS = {
	OP: 'Overpass',
	UP: 'Underpass',
	OFF: 'Offramp',
	ON: 'Onramp',
	// Not a part
	FWY: ''
};

function toSentenceCase(string) {
	return string.substring(0, 1).toUpperCase() + string.substring(1).toLowerCase();
}

function toTitleCase(string) {
	let words = string.split(' ');

	for (let i = 0; i < words.length; i++) {
		words[i] = toSentenceCase(words[i]);
	}

	return words.join(' ');
}

function transformFreeways(string) {
	// Freeway handling
	// /((?:MF|H[13])[EW]|H2[NS]) (.*?) ([OU]P|OFF|ON)/g
	return string.replace(/(MF|H[1-3])([NEWS]) *(.*?) ([OU]P|OFF|ON|FWY)/g, (match, freeway, direction, content, part) => {
		return `${FREEWAY_NAMES[freeway]} Fwy ${FREEWAY_DIRECTIONS[direction]}bound ${content} ${FREEWAY_PARTS[part]}`;
	}).replace(/(.+) (ONTO|FROM) (MF|H[1-3])([NEWS]) *(.*)/g, (match, origin, type, freeway, direction, destination) => {
		return `${origin} ${type} ${FREEWAY_NAMES[freeway]} Fwy ${FREEWAY_DIRECTIONS[direction]}bound${destination === '' ? '' : ` at ${destination}`}`;
	}).replace(/(MF|H[1-3])([NEWS])/g, (match, freeway, direction) => {
		return `${FREEWAY_NAMES[freeway]} Fwy ${FREEWAY_DIRECTIONS[direction]}bound`;
	});
}

function toAddressCase(string) {
	return toTitleCase(transformFreeways(string.replace(/(\w)&(\w)/g, '$1 & $2'))).replace(/(\d+)([a-zA-Z])/g, (match, group1, group2) => {
		return group1 + group2.toUpperCase();
	});
}

function transformLocations(string) {
	return string.replace(/PK$/g, 'Park')
		.replace(/CTR/g, 'Center')
		.replace(/SQR/g, 'Square')
		.replace(/APTS/g, 'Apartments')
		.replace(/BCH/g, 'Beach')
		.replace(/SCH/g, 'Beach')
		.replace(/STN/g, 'Station')
		.replace(/MP/g, 'Marketplace');
}

function transformArea(string) {
	return string.replace(/MOANALUA V/g, 'Moanalua Valley');
}

function getIncidents() {
	return new Promise((resolve, reject) => {
		let request = http.get('http://www11.honolulu.gov/hpdtraffic/MainPrograms/frmMain.asp?sSearch=All+Incidents&sSort=I_tTimeCreate', (response) => {
			let data = '';
			let incidents = [];

			// A chunk of data has been recieved.
			response.on('data', (chunk) => {
				data += chunk;
			});

			response.on('error', (error) => {
				reject(error);
			});

			response.on('end', () => {
				data = data.match(/<table.*?width="100%">([\s\S]+?)<\/table>/);
				if (!data) {
					resolve([]);
					return;
				}

				if (!data[0]) {
					console.log(data);
					return;
				}
				
				data = data[0].trim();

				let root = parse(data);
				let table = root.querySelector('table');
				table.removeWhitespace();

				// A missing font closing tag breaks the table
				// The result is to start at 8 instead of 3
				for (let i = 8; i < table.childNodes.length; i++) {
					let row = table.childNodes[i];
					let date = row.childNodes[0].text;
					let time = row.childNodes[1].text;
					let type = row.childNodes[2].text;
					let address = row.childNodes[3].text;
					let location = row.childNodes[4].text;
					let area = row.childNodes[5].text;

					incidents.push({
						time: new Date(`${date} ${time}`),
						type: toSentenceCase(type),
						area: area === '' ? null : toTitleCase(transformArea(area)),
						address: toAddressCase(transformLocations(address)),
						location: location === '' ? null : toAddressCase(transformLocations(location))
					});
				}

				resolve(incidents);
			});
		});

		request.on('error', (error) => {
			reject(error);
		});
	});
}

router.get("/", async (request, response, next) => {
	response.setHeader('Content-Type', 'text/plain');

	if (request.method == 'GET') {
		try {
			response.send(JSON.stringify(await getIncidents()));
		} catch (error) {
			console.log(error);

			response.send('[]');
		}

		return;
	}

	// Trigger the error handler chain
	next(new Error('405 Method Not Allowed'));
});

module.exports = router;
