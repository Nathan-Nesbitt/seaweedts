import { Volume } from "./volume";
import { Master } from "./master";

export class SeaweedClientConfig {
	/** Host which has the master server running 
	*/
	host: string;
	
	/** Port of the master server 
	 * If there is no IP, you can just leave blank and it will ignore the port
	*/
	port?: number;

	/** Should you use HTTP or HTTPS? */
	https?: boolean;
}

/**
 * Client class for connecting to the master and volumes.
 * 
 * Based on the main repo: 
 * - https://github.com/seaweedfs/seaweedfs/wiki/Master-Server-API
 * - https://github.com/seaweedfs/seaweedfs/wiki/Volume-Server-API
 * 	
 * Normally these are on port 9333 and 8080.
 * 
 */
export class SeaweedClient {

	private masterNodeURL: string;
	private host: string;
	private port: number;
	private https: boolean;

	/**
	 * Creates an instance of the seaweed client. 
	 * 
	 * This queries the master server, and by extension the volumes.
	 * 
	 * @param config Config file for the master node
	 */
	constructor(config: SeaweedClientConfig = {
		host: "localhost",
		port: 9333,
		https: false
	}) {
		Object.assign(this, config);
		const port = this.port ? `:${this.port}` : "";
		this.masterNodeURL = `${this.getProtocol()}://${this.host}${port}`;
	}
	
	/** Gets the protocol depending on if you set the client up as https or not */
	getProtocol() {
		return this.https ? "https" : "http";
	}


	/**
	 * Gets the volume ID, aka the value before the comma in the FID.
	 * @param fid FID for a document
	 * @returns VolumeID
	 */
	public getVolumeIDFromFID(fid: string): number {
		return parseInt(fid.split(",")[0]);
	}

	/**
		 * Removes all null parameters, only grabs the ones that have some set value as
		 * all methods are either default "" or false.
		 * @param parameters Parameter list provided
		 * @returns URL encoded parameter list as a string
		 */
	protected	parseParameters(parameters: Volume.Parameters.VolumeParameters | Master.Parameters.MasterParameters) {
		if (!parameters) return "";
		return Object.entries(parameters).filter(([, val]) => {
			return (val && val != "");
		}).map(([key, val]) => {
			return `${key}=${encodeURIComponent(val)}`;
		}).join("&");
	}

	/**
	 * Gets the volume URL if it is not already defined
	 * in the parameters.
	 * 
	 * @param parameters File option for a volume 
	 */
	private async getVolumeURLIfNotDefined(parameters: Volume.Parameters.File) {
		if (!parameters.volumeURL) {
			const volume = this.getVolumeIDFromFID(parameters.fid);
			const volumeInfo = await this.findVolumeInfo(volume);
			if(!volumeInfo.locations.length) new Volume.Error.NoVolumeServerFoundError(`${volume}`);
			parameters.volumeURL = parameters.public ? volumeInfo.locations[0].publicUrl : volumeInfo.locations[0].url;
		}
		return parameters;
	}

	/**
	 * This generates the URL for the volume you want to hit, and provides
	 * the fid for the new object you want to create.
	 */
	public assign(parameters ?: Master.Parameters.Assign): Promise<Master.Response.Assign> {
		return new Promise((resolve, reject) => {
			const fullURL = `${this.masterNodeURL}/dir/assign?${this.parseParameters(parameters)}`;
			fetch(fullURL).then(response => {
				response.json().then(json => {
					resolve(json as Master.Response.Assign);
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	public findVolumeInfo(volumeId: number): Promise<Master.Response.VolumeInfo> {
		return new Promise((resolve, reject) => {
			const url = `${this.masterNodeURL}/dir/lookup?volumeId=${volumeId}`;
			fetch(url).then(response => {
				response.json().then(json => {
					resolve(json as Master.Response.VolumeInfo);
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	/**
	 * Writes buffer to server, currently doesn't support streams as the fetch
	 * API does not handle streams properly in NodeJS.
	 * 
	 * @param parameters 
	 * @returns 
	 */
	public write(parameters: Volume.Parameters.WriteFile): Promise<Volume.Response.Write> {
		return new Promise((resolve, reject) => {
			const url = `${this.getProtocol()}://${parameters.volumeURL}/${parameters.fid}`;
			
			const form = new FormData();
			const blob: Blob = new Blob([parameters.file]);
			form.append("file", blob, parameters.filename);
			
			fetch(url, {body: form, method: "POST"}).then(response => {
				response.json().then(json => {
					resolve(json as Volume.Response.Write);
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	public update(parameters: Volume.Parameters.UpdateFile): Promise<Volume.Response.Update> {
		return new Promise((resolve, reject) => {
			this.getVolumeURLIfNotDefined(parameters).then((parameters: Volume.Parameters.UpdateFile) => {
				const form = new FormData();
				form.append("file", new Blob([parameters.file]), parameters.filename);
				
				const fullURL = `${this.getProtocol()}://${parameters.volumeURL}/${parameters.fid}`;
				fetch(fullURL, {body: form, method: "POST"}).then(response => {
					response.json().then(json => {
						resolve(json as Volume.Response.Write);					
					}).catch(err => reject(err));
				}).catch(err => { return reject(err); });
			});
		});
	}

	public delete(parameters: Volume.Parameters.DeleteFile): Promise<Volume.Response.Delete> {
		return new Promise((resolve, reject) => {
			this.getVolumeURLIfNotDefined(parameters).then((parameters: Volume.Parameters.DeleteFile) => {
				
				const fullURL = `${this.getProtocol()}://${parameters.volumeURL}/${parameters.fid}`;
				fetch(fullURL, {method: "DELETE"}).then(response => {
					response.json().then(json => {
						if (response.status === 404) return reject(new Volume.Error.NoFileFoundError(parameters.fid));
						if (!json) return reject(new Volume.Error.DeleteError(parameters.fid));
						return resolve(json as Volume.Response.Delete);
					}).catch(err => reject(err));
				}).catch(err => { return reject(err); });
			}).catch(err => { return reject(err); });
		});
	}

	private _get(parameters: Volume.Parameters.GetFile): Promise<Response> {
		return new Promise((resolve, reject) => {
			this.getVolumeURLIfNotDefined(parameters).then((parameters: Volume.Parameters.GetFile) => {
				const fullURL = `${this.getProtocol()}://${parameters.volumeURL}/${parameters.fid}`;
				fetch(fullURL).then(response => {
					if (response.status === 404)
						return reject(new Volume.Error.NoFileFoundError(parameters.fid));
					resolve(response);
				}).catch(err => { return reject(err); });
			});
		});
	}

	/**
	 * Gets an object from the server, returns the response as a blob.
	 * 
	 * If you want to save the file, you'd have to call `await file.arrayBuffer()`  
	 * 
	 * @param parameters - Parameters on how you want to get the file
	 * @returns the response object
	 */
	public get(parameters: Volume.Parameters.GetFile): Promise<Blob> {
		return new Promise((resolve, reject) => {
			this._get(parameters).then(response => {
				return resolve(response.blob());
			}).catch(err => reject(err));
		});
	}

	/**
	 * Gets an object from the server, returns the response as a stream.  
	 * 
	 * @param parameters - Parameters on how you want to get the file
	 * @returns the response object
	 */
	public async* getStream(parameters: Volume.Parameters.GetFile) {
		// Get the data from the server
		const response = await this._get(parameters);
		const reader = response.body.getReader();
		// Loop through the blocks, yielding them
		while (true) {
			const {value, done} = await reader.read();
			if (done) break;
			yield value;
		}
	}

	/**
	 * Forces garbage collection on servers. It will create a new volume with only existing
	 * records, freeze the old one, switch to the new volume and delete the old. 
	 * @param threshold Empty space threshold
	 * @returns JSON response body
	 */
	public vaccum(threshold: number = 0.3): Promise<Master.Response.Vaccum> {
		return new Promise((resolve, reject) => {
			const fullURL = `${this.masterNodeURL}/vol/vacuum?garbageThreshold=${threshold}`;
			fetch(fullURL, {method: "DELETE"}).then(response => {
				response.json().then(json => {
					resolve(json);					
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	/**
	 * One volume serves one write a time. If you need to increase concurrency, 
	 * you can pre-allocate volumes. 
	 * @returns JSON
	 */
	public preAllocateVolumes(params: Master.Parameters.PreAllocateVolumes) {
		return new Promise((resolve, reject) => {
			const fullURL = `${this.masterNodeURL}/vol/grow?${this.parseParameters(params)}`;
			fetch(fullURL).then(response => {
				response.json().then(json => {
					resolve(json);				
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	/**
	 * Deletes a collection by name
	 * @param collectionName Name of the collection
	 * @returns 
	 */
	public deleteCollection(collectionName: string): Promise<JSON> {
		return new Promise((resolve, reject) => {
			const fullURL = `${this.masterNodeURL}/col/delete?collection=${collectionName}`;
			fetch(fullURL, {method: "POST"}).then(response => {
				response.json().then(json => {
					resolve(json);				
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	public systemStatus(): Promise<Master.Response.SystemStatus> {
		return new Promise((resolve, reject) => {
			fetch(`${this.masterNodeURL}/cluster/status`).then(response => {
				response.json().then(json => {
					resolve(json);
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	public systemHealth(): Promise<number> {
		return new Promise((resolve, reject) => {
			fetch(`${this.masterNodeURL}/cluster/healthz`).then(response => {
				return resolve(response.status);
			}).catch(err => { return reject(err); });
		});
	}

	public writableVolumeStatuses(): Promise<Master.Response.WritableVolumeStatus> {
		return new Promise((resolve, reject) => {
			fetch(`${this.masterNodeURL}/dir/status`).then(response => {
				response.json().then(json => {
					resolve(json);
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	/**
	 * Does a lookup on the volume to see if it has moved.
	 */
	public lookup(lookupParams: Master.Parameters.Lookup): Promise<Master.Response.Lookup> {
		return new Promise((resolve, reject) => {
			fetch(`${this.masterNodeURL}/dir/lookup?${this.parseParameters(lookupParams)}`).then(response => {
				if(response.status != 200) 
					return reject(new Master.Error.NoVolumeFound(lookupParams.volumeId)); 
				response.json().then(json => {
					return resolve(json as Master.Response.Lookup);					
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	/**
	 * See the status of the volumes seen by the master
	 * @returns promise of volume status
	 */
	public volumeStatuses(): Promise<Master.Response.VolumeStatuses> {
		return new Promise((resolve, reject) => {
			fetch(`${this.masterNodeURL}/dir/status`).then(response => {
				response.json().then(json => {
					return resolve(json as Master.Response.VolumeStatuses);					
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}

	public volumeServerStatus(server: string): Promise<Volume.Response.ServerStatus> {
		return new Promise((resolve, reject) => {
			fetch(`${this.getProtocol()}://${server}/status`).then(response => {
				response.json().then(json => {
					return resolve(json as Volume.Response.ServerStatus);					
				}).catch(err => reject(err));
			}).catch(err => { return reject(err); });
		});
	}
}
