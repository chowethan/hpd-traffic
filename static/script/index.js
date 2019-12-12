import _ from './lib.js';
import Tooltip from './tooltip.js';
const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let tableHeadElement = document.getElementById('thead').children[0];
let tableBodyElement = document.getElementById('tbody');
let statusElement = document.getElementById('status');
let updatedElement = document.getElementById('updated');

let records = [];
let lastUpdated = -1;
let filter = {search: null, area: null, type: null};

function getTimeDifference(difference, short) {
	if (difference < 10000) {
		return 'just now';
	} else if (difference < 30000) {
		return 'seconds ago';
	} else if (difference < 180000) {
		return `a ${short ? 'min' : 'minute'} ago`;
	} else if (difference < 600000) {
		return `several ${short ? 'mins' : 'minutes'} ago`;
	} else if (difference < 3600000) {
		return `${Math.floor((difference) / 60000)} ${short ? 'mins' : 'minutes'} ago`;
	} else {
		let hours = Math.floor((difference) / 3600000);
		return `${hours} ${short ? 'hr' : 'hour'}${hours > 1 ? 's' : ''} ago`;
	}
}

function updateStatus(newStatus) {
	let now = Date.now();
	let text = '';

	if (newStatus !== undefined) {
		statusElement.innerText = newStatus;
	}

	if (lastUpdated == -1) {
		updatedElement._tooltip.setText(null);
	} else {
		text = `Updated ${getTimeDifference(now - lastUpdated)}`;
		let date = new Date(lastUpdated);
		updatedElement._tooltip.setText(`Updated at ${date.getHours() > 12 ? date.getHours() - 12 : date.getHours()}:${date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()} ${date.getHours() < 12 || date.getHours() == 24 ? 'AM' : 'PM'}`)
	}

	updatedElement.innerText = text;
}

function recalculateColumns() {
	requestAnimationFrame(() => {
		let widths = [];

		if (tableBodyElement.children.length > 0) {
			let start = performance.now();
			for (let cell of tableBodyElement.children[0].children) {
				widths.push(cell.getBoundingClientRect().width);
			}

			for (let i = 0; i < widths.length; i++) {
				tableHeadElement.children[i].style.maxWidth = `${widths[i]}px`;
				tableHeadElement.children[i].style.minWidth = `${widths[i]}px`;
				tableHeadElement.children[i].style.width = `${widths[i]}px`;
			}
			console.log(`Column recalculation took ${performance.now() - start} ms`);
		}

	});
}

function filterIncident({search: terms, area, type}) {
	if (terms === null) {
		terms = '';
	}
	
	let termReplacements = [
		// Street terms
		[/street/g, 'st'],
		[/road/g, 'rd'],
		[/avenue/g, 'ave'],
		[/highway/g, 'hwy'],
		[/place/g, 'pl'],
		[/lane/g, 'ln'],
		[/drive/g, 'dr'],
		[/boulevard/g, 'bl'],
		[/blvd/g, 'bl'],
		[/loop/g, 'lp'],
		[/circle/g, 'cir'],
		// Hawaiian vowels
		[/ā/g, 'a'],
		[/ē/g, 'e'],
		[/ī/g, 'i'],
		[/ō/g, 'o'],
		[/ū/g, 'u'],
		// Miscellaneous
		[/\t/g, ' '],
		[/\band\b/g, ''],
		[/[^A-Za-z0-9 ]+/g, ''],
		[/ {2,}/g, ' ']
	];
	let recordReplacements = [
//		[/bch park$/, 'beach park'],
//		[/par$/, 'park'],
//		[/scho$/, 'school'],
		
		[/[^A-Za-z0-9 ]+/g, '']
	];
//	let lowRelevanceTerms = ['st', 'rd', 'ave', 'hwy', 'pl', 'ln', 'dr', 'bl', 'lp', 'cir', 'fwy'];
	let lowRelevanceTerms = [];
	let comparisonKeys = ['type', 'area', 'address', 'location'];
	
	terms = terms.toLowerCase();
	for (let i = 0; i < termReplacements.length; i++) {
		terms = terms.replace(termReplacements[i][0], termReplacements[i][1]);
	}
	terms = terms.trim();
	terms = terms.split(' ');

	let results = [];
	for (let i = 0; i < records.length; i++) {
		let record = records[i];
		let comparisonValues = {};
		let matches = {};
		
		// Filter area and type
		if (filter.area !== null && (record.area === null || record.area.toLowerCase() !== filter.area.toLowerCase())) {
			continue;
		} else if (filter.type !== null && record.type.toLowerCase() !== filter.type.toLowerCase()) {
			continue;
		}
		
		// Store the value used for comparison of each key in comparisonValues
		// Store the matches for each key in matches
		for (let key of comparisonKeys) {
			if (record[key] !== null) {
				comparisonValues[key] = record[key].toLowerCase();
				matches[key] = { high: [], low: [] };
			}
		}
		// Used to determine how relevant a result is based on the order of the original search terms
		let matchPositions = [];
		let orderScore = 0;
		let lowRelevanceMatches = [];
		
		// Replace all of the comparison values with the record replacements
		for (let j = 0; j < recordReplacements.length; j++) {
			for (let key of comparisonKeys) {
				if (record[key] !== null) {
					comparisonValues[key] = comparisonValues[key].replace(recordReplacements[j][0], recordReplacements[j][1]);
				}
			}
		}
		
		// Generate the matches for all of the comparison keys
		for (let j = 0; j < terms.length; j++) {
			for (let key of comparisonKeys) {
				if (record[key] !== null) {
					if (comparisonValues[key].indexOf(terms[j]) != -1) {
						if (lowRelevanceTerms.indexOf(terms[j]) != -1) {
							matches[key].low.push(terms[j]);
						} else {
							matches[key].high.push(terms[j]);
							matchPositions.push(comparisonValues[key].indexOf(terms[j]));
						}
					}
				}
			}
		}
		
		// Create the order score, to elevate records that have words in the same order as the query
		let previousPosition = matchPositions.length > 0 ? matchPositions[0] : 0;
		for (let i = 1; i < matchPositions.length; i++) {
			if (previousPosition < matchPositions[i]) {
				orderScore++;
				previousPosition = matchPositions[i];
			}
		}
		
		let relevance = 0;
		
		for (let key of comparisonKeys) {
			if (record[key] !== null) {
				relevance += (matches[key].high.length + (matches[key].low.length / 4));
			}
		}
		
		relevance /= comparisonKeys.length;
		relevance /= terms.length;
		
		if (relevance > 0.2) {
			results.push({...record, relevance: relevance, orderScore: orderScore});
		}
	}
	
	/*
	// Sort results
	if (terms === '') {
		results.sort((a, b) => {
			if (a.time != b.time) {
				return a.time > b.time ? -1 : 1;
			} else {
				return 0;
			}
		});
	} else {
		results.sort(function (a, b) {
			if (a.relevance != b.relevance) {
				return a.relevance > b.relevance ? -1 : 1;
			} else {
				if (a.orderScore != b.orderScore) {
					return a.orderScore > b.orderScore ? -1 : 1;
				} else {
					return a.Name < b.Name ? -1 : 1;
				}
			}
		});
	}*/
	
	return results;
}

function updateIncidents() {
//	let incidents = records.filter(filterIncident);
	let incidents = filterIncident(filter);

	for (let i = 0; i < incidents.length; i++) {
		let incident = incidents[i];
		let date = new Date(incident.time);
		let now = new Date();

		if (i >= tableBodyElement.children.length) {
			let row = document.createElement('tr');
			row.appendChild(document.createElement('td'));
			row.appendChild(document.createElement('td'));
			row.appendChild(document.createElement('td'));
			row.appendChild(document.createElement('td'));
			row.appendChild(document.createElement('td'));
			tableBodyElement.appendChild(row);
		}

		let row = tableBodyElement.children[i];
		let time = row.children[0];
		time.innerText = getTimeDifference(Date.now() - date.getTime(), true);
		let type = row.children[1];
		type.innerText = incident.type;
		let area = row.children[2];
		area.innerText = incident.area;
		let address = row.children[3];
		address.innerText = incident.address;
		let location = row.children[4];
		location.innerText = incident.location;

		if (!time._tooltip) {
			time._tooltip = new Tooltip(time);
		}
		
		time._tooltip.setText(`${date.getHours() > 12 ? date.getHours() - 12 : date.getHours()}:${date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()} ${date.getHours() < 12 || date.getHours() == 24 ? 'AM' : 'PM'}`);
	}

	for (let i = tableBodyElement.children.length - 1; i >= incidents.length; i--) {
		if (tableBodyElement.children[i].children[0]._tooltip) {
			tableBodyElement.children[i].children[0]._tooltip.destroy();
		}
		tableBodyElement.removeChild(tableBodyElement.children[i]);
	}

	recalculateColumns();
	
	if (filter.search !== null || filter.area !== null || filter.type !== null) {
		updateStatus(`Showing ${incidents.length}${filter.type !== null ? ` ${filter.type.toLowerCase()}` : ''} incident${incidents.length === 1 ? '' : 's'}${filter.search !== null ? ` matching "${filter.search}"` : '' }${filter.area !== null ? ` in ${filter.area}` : ''}`);
	} else {
		updateStatus(`Showing all ${incidents.length} incident${incidents.length === 1 ? '' : 's'}`);
	}
}

async function loadIncidents() {
	updateStatus('Updating...');
	try {
		records = await _.getJSON('/api/incidents');
		lastUpdated = Date.now();

		updateIncidents();
	} catch (error) {
		console.log(error);
		updateStatus('An error occurred');
	}
}

document.addEventListener('DOMContentLoaded', () => {
	document.fonts.ready.then(recalculateColumns);
	
	let leftSidebar = document.getElementById('left-sidebar');
	let selectElements = document.getElementsByClassName('mdc-select');
	
	for (let selectElement of selectElements) {
//		mdc.select.MDCSelect.attachTo(selectElement);
		selectElement.mdcElement = new mdc.select.MDCSelect(selectElement);
	}
	
	document.getElementById('search').addEventListener('input', (event) => {
		if (event.target.value.trim() === '') {
			filter.search = null;
		} else {
			filter.search = event.target.value;
		}
		updateIncidents();
	});
	
	function resizeDropdown(event) {
		let selectElement = event.target;

		while (!selectElement.classList.contains('mdc-select')) {
			selectElement = selectElement.parentElement;
		}

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				let dropdown = selectElement.querySelector('.mdc-select__menu');
				let sidebarRect = leftSidebar.getBoundingClientRect();
				let dropdownRect = dropdown.getBoundingClientRect();
				dropdown.style.maxHeight = `${(sidebarRect.height + sidebarRect.y) - dropdownRect.y}px`;
			});
		});
	}
	
	let areaFilterElement = document.getElementById('area-filter');
	let typeFilterElement = document.getElementById('type-filter');
	
	// Fix dropdown length
	areaFilterElement.addEventListener('mouseup', resizeDropdown);
	typeFilterElement.addEventListener('mouseup', resizeDropdown);
	
	areaFilterElement.mdcElement.listen('MDCSelect:change', () => {
		if (areaFilterElement.mdcElement.selectedIndex === 0) {
			filter.area = null;
		} else {
			filter.area = areaFilterElement.mdcElement.value;
		}
		
		updateIncidents();
	});
	typeFilterElement.mdcElement.listen('MDCSelect:change', () => {
		if (typeFilterElement.mdcElement.selectedIndex === 0) {
			filter.type = null;
		} else {
			filter.type = typeFilterElement.mdcElement.value;
		}
		
		updateIncidents();
	});
	
	updatedElement._tooltip = new Tooltip(document.getElementById('refresh-info'));

	recalculateColumns();
	updateStatus();
	loadIncidents();

	window.addEventListener('resize', () => {
		recalculateColumns();
	});

	setInterval(loadIncidents, 30000);
	setInterval(updateStatus, 1000);

	document.getElementById('refresh').addEventListener('click', loadIncidents);
//	document.getElementById('recalc').addEventListener('click', () => {
//		recalculateColumns();
//	});
//	document.getElementById('time').addEventListener('click', () => {
//		lastUpdated -= 60000;
//		updateStatus();
//	});
});
