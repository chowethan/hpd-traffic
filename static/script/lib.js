let _ = {};

(() => {
	let insertElement = document.createElement('div');
	
//	_.request = (url, method, headers, body) => {
//		method = method ? method : 'GET';
//
//		return fetch(url, {
//			method: method,
//			cache: 'no-cache',
//			headers: headers ? headers : undefined,
//			body: method == 'GET' || method == 'HEAD' || !body ? undefined : body
//		});
//	};
	
	_.request = async (url, method, headers, body) => {
		method = method ? method : 'GET';

		let response = await fetch(url, {
			method: method,
			cache: 'no-cache',
			headers: headers ? headers : undefined,
			body: method == 'GET' || method == 'HEAD' || !body ? undefined : body
		});
		let length = response.headers.get('Content-Length');
		
		if (!length) {
			// something was wrong with response, just give up
			return await response.arrayBuffer();
		}
		
		const array = new Uint8Array(length);
		let at = 0;  // to index into the array
		const reader = response.body.getReader();
		
		while (true) {
			const {done, value} = await reader.read();
			
			if (done) {
				break;
			}
			
			array.set(value, at);
			at += value.length;
			console.log(at, length);
		}
		
		return new TextDecoder("utf-8").decode(array);
	};

//	_.getJSON = (url, headers) => {
//		return _.request(url, 'GET', headers).then((response) => {
//			return response.json();
//		});
//	};

	_.getJSON = (url, headers) => {
		return _.request(url, 'GET', headers).then((response) => {
			return JSON.parse(response);
		});
	};
	
	_.createHTML = (htmlString, parentElement) => {
		let returnValue = null;

		insertElement.insertAdjacentHTML("beforeend", htmlString);

		if (insertElement.childNodes.length == 0) {
			return null;
		} else {
			returnValue = [...insertElement.childNodes];
		}

		// Remove new nodes from dummy element
		while (insertElement.lastChild) {
			insertElement.removeChild(insertElement.lastChild);
		}

		// Insert elements into new parent
		if (parentElement) {
			for (let element of returnValue) {
				parentElement.appendChild(element);
			}
		}

		if (returnValue.length == 1) {
			return returnValue[0];
		}

		return returnValue;
	};
})();

export default _;
