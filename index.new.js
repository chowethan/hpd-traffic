const Directory = {};
Directory.SELF = __dirname + '/';
Directory.INCLUDE = Directory.SELF + 'include/';
Directory.STATIC = Directory.SELF + 'static/';
Directory.TEMPLATE = Directory.SELF + 'template/';
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const application = require('express')();
const http = require('http');
const createError = require('http-errors');
const server = http.createServer(application);
const fs = require('fs');
const handlebars = require('handlebars');
const utility = require(Directory.INCLUDE + 'utility.js');
const ServerError = require(Directory.INCLUDE + 'ServerError.js');

const listenPort = process.env.PORT || 8080; // 3000;
const listenAddress = '0.0.0.0';

// Add headers
application.use(async (request, response, next) => {
	// Request methods you wish to allow
	response.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
	
	// Pass to next layer of middleware
	next();
});

application.get('/', async (request, response) => {
	response.sendFile(Directory.STATIC + 'index.html');
});

// Catch 405 errors
// Supported methods are in ALLOWED_METHODS
application.use(async (request, response, next) => {
	// Filter for methods
	if (ALLOWED_METHODS.indexOf(request.method) > -1) {
		// Pass the request down the chain
		next();
		
		return;
	}
	
	// Trigger the error handler chain
	next(createError(405, {_method: request.method, _requestPath = request.path}));
});

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
					next(createError(404, {_method: request.method, _requestPath: request.path, _transformedPath: path, _internalPath: internalPath, _originalError: error}));
					
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
application.use(async (mainError, request, response, next) => {
	// If there is a specific error object for the given error, use it. Otherwise, use 500
	// Internal Server Error
	let errorType = mainError.status in ServerError ? ServerError[mainError.status] : ServerError[500];
	
	// Return the correct status code header
	response.status(mainError.status);
	
	let errorID;
	
	try {
		errorID = utility.randomString(25);
	} catch (error) {
		// Couldn't generate an ID
		console.error('Application error:');
		console.error(mainError);
		console.error('Error generating reference ID:');
		console.error(error);
		console.error('');
		
		// Send a plain text error
		response.setHeader('Content-Type', 'text/plain');
		response.send(`${mainError.staturType.name}`);
		
		return;
	}

	console.error(`Application error reference ID: ${errorID}`);
	console.error(mainError);
	
	fs.readFile(Directory.TEMPLATE + 'error.html', 'utf8', (error, data) => {
		if (error) {
			// Couldn't read the error template
			console.error('Error reading template:');
			console.error(error);
			console.error('');

			// Send a plain text error
			response.setHeader('Content-Type', 'text/plain');
			response.send(`${mainError.status} ${mainError.message}\nError Reference ID: ${errorID}`);

			return;
		}
		
		let errorTemplate = handlebars.compile(data);
		
		try {
			let errorPage = errorTemplate({
				errorCode: mainError.status,
				errorName: mainError.message,
				errorMessage: errorType.message,
				errorInformation: () => {
					if (typeof errorType.information == 'function') {
						return errorType.information(request.method, request.path);
					}
					
					return errorType.information;
				},
				errorHelpText: () => {
					if (typeof errorType.helpText == 'function') {
						return errorType.helpText(errorID);
					}
					
					return errorType.helpText;
				}
			});
			
			response.setHeader('Content-Type', 'text/html');
			response.send(errorPage);
		} catch (error) {
			// Couldn't compile the error template
			console.error('Error compiling template:');
			console.error(error);
			console.error('');
			
			// Send a plain text error
			response.setHeader('Content-Type', 'text/plain');
			response.send(`${mainError.status} ${mainError.message}\nError Reference ID: ${errorID}`);
		}
	});
});

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
