const parse = require('node-html-parser').parse;
const fs = require('fs');
const application = require('express')();
const http = require('http');
const server = http.createServer(application);

const Directory = {};
Directory.SELF = __dirname + '/';
Directory.STATIC = `${Directory.SELF}static/`;
Directory.ROUTER = `${Directory.SELF}router/`;

const listenPort = process.env.PORT || 8080; // 3000;
const listenAddress = '0.0.0.0';

let types = [];
let areas = [];

// API Endpoint
application.use('/api/incidents/', require(`${Directory.ROUTER}incidents.js`));

// Attempt to serve any file
application.use(async (request, response, next) => {
	let path = request.path;
	// Removes the leading slash
	let internalPath = Directory.STATIC + path.substring('/'.length);
	
	if (path.charAt(path.length - 1) == '/') {
		// Try to route to an index if the request is for a directory
		internalPath += 'index';
	}
	
	// Look for a file with the same path but with the .html extension appended
	// This allows /test to point to /test.html
	fs.access(internalPath + '.html', fs.constants.R_OK, (error) => {
		if (error) {
			// Look for the explicit file
			fs.access(internalPath, fs.constants.R_OK, (error) => {
				if (error) {
					// Trigger the error handler chain
					next(new Error('404 Not Found'));
					
					return;
				}
				
				let redirect = undefined;
				
				// Redirect any relative /index.html to just the relative /
				// Redirect any .html file to the URL without the extension
				if (path.substring(path.length - '/index.html'.length) == '/index.html') {
					redirect = path.substring(0, path.length - 'index.html'.length);
				} else if (path.substring(path.length - '.html'.length) == '.html') {
					redirect = path.substring(0, path.length - '.html'.length);
				}
					
				if (redirect !== undefined) {
					// Send a 301 Moved Permanently
					response.status(301);
					response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
					response.setHeader('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT');
					response.setHeader('Location', redirect);
					response.send('');
				} else {
					// Send the file
					response.sendFile(internalPath);
				}
			});
			
			return;
		}
		
		let redirect = undefined;
		
		// Redirect any relative /index to just the relative /
		if (path.substring(path.length - '/index'.length) == '/index') {
			redirect = path.substring(0, path.length - 'index'.length);
		}
		
		if (redirect !== undefined) {
			// Send a 301 Moved Permanently
			response.status(301);
			response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
			response.setHeader('Expires', 'Thu, 01 Jan 1970 00:00:00 GMT');
			response.setHeader('Location', redirect);
			response.send('');
		} else {
			// Send the file
			response.sendFile(internalPath + '.html');
		}
	});
});

// Handle errors
application.use(async (error, request, response, next) => {
	response.setHeader('Content-Type', 'text/plain');
	response.send('Error');
});

function scrape() {
	function toTitleCase(string) {
		let words = string.split(' ');

		for (let i = 0; i < words.length; i++) {
			words[i] = words[i].substring(0, 1).toUpperCase() + words[i].substring(1).toLowerCase();;
		}

		return words.join(' ');
	}
	
    let request = http.get('http://www11.honolulu.gov/hpdtraffic/MainPrograms/frmMain.asp?sSearch=All+Incidents&sSort=I_tTimeCreate', (response) => {
        let data = '';

        // A chunk of data has been recieved.
        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('error', (error) => {
            console.log(error);
        });

        response.on('end', () => {
//            data = data.match(/<table.*?>([\s\S]+?)<\/table>/)[0].trim();
            data = data.match(/<table.*?width="100%">([\s\S]+?)<\/table>/)[0].trim();

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

                if (types.indexOf(type) == -1) {
                    types.push(type);
                }
                if (areas.indexOf(toTitleCase(area)) == -1) {
                    areas.push(toTitleCase(area));
                }
            }

            types.sort();
            areas.sort();
            console.log(types);
            console.log(JSON.stringify(areas));
        });
    });

    request.on('error', (error) => {
        if (error.code != 'ENOTFOUND') {
            console.log(error);
        }
    });
}

scrape();
setInterval(scrape, 1000 * 60 * 5);

function start() {
	server.listen(listenPort, listenAddress, () => {
		console.log('Listening on ' + listenAddress + ':' + listenPort);
	});
}

function exit() {
	console.log('Shutting down.');
	process.exit();
}

process.on('SIGINT', () => {
	exit();
});

process.on('unhandledRejection', (error) => {
	console.log('Caught unhandledRejection');
	console.log(error);
});

start();
