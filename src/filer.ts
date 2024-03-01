import { Master } from "./master";

class SeaweedError extends Error {}

export namespace Filer {
	export namespace Errors {
		export class SeaweedInvalidTag extends SeaweedError {
			constructor(tags: string[]);
			constructor(tags: [string, string][]);
			constructor(tags ?: string[] | [string, string][]) {
				const tagStrings: string[] = tags.map((values) => {
					switch(typeof values) {
					case "string":
						return values;
					default:
						return `${values[0]}:${values[1]}`;
					}
				});
				super(`Tags must start with Seaweed- Invalid tags provided: ${tagStrings.toString()}`);
			}
		}
	}

	export namespace Parameters {
		export interface SeaweedFilerParameters {}
		
		/**
		 * Parameters that can be added to the URL for each post request
		 */
		export interface Post extends SeaweedFilerParameters {
			dataCenter?: string;
			rack?: string;
			dataNode?: string;
			
			/** required collection name */
			collection?: string;

			/** replica placement strategy */
			replication?: Master.Types.SeaweedReplication;

			/** if "true", the file content write will incur an fsync operation (though the file metadata will still be separate) */
			fsync?: boolean;

			/** if "true", the file content will write to metadata default false */
			saveInside?: boolean;

			/** time to live, examples, 3m: 3 minutes, 4h: 4 hours, 5d: 5 days, 6w: 6 weeks, 7M: 7 months, 8y: 8 years */
			ttl?: string;

			/** max chunk size */
			maxMB?: string;

			/** file mode default "0660" */
			mode?: string;

			/** file operation, currently only supports "append"*/
			op?: "append" | null;

			/** Ensuring parent directory exists cost one metadata API call. 
			 * Skipping this can reduce network latency. Default false */
			skipCheckParentDir?: boolean;
		}

		/**
		 * Parameters that can be added to the URL for each put request
		 */
		export interface Put extends Post { }

		export interface Get extends SeaweedFilerParameters {
				/** Get the file / directory metadata, default false*/
				metadata ?: boolean;
				/** Resolve manifest chunks, default false */
				resolveManifest ?: boolean;
				"response-content-disposition"?: "attachment" | "inline";
		}

		export interface Delete extends SeaweedFilerParameters {
			/** Default is configured in the filer recursive_delete option from filer.toml */
			recursive ?: boolean,

			/** Ignore any errors thrown in recursive mode, default false */
			ignoreRecursiveError ?: boolean,

			/** Do not delete any file chunks on volume servers, default false */
			skipChunkDeletion ?: boolean
		}

		export interface List extends SeaweedFilerParameters {
			/** Number of files limit, default 100 */
			limit ?: number,

			/** The last file name that was queried */
			lastFileName ?: string

			/** Pattern matching, includes files from query based on * and ? syntax. Case sensitive. */
			namePattern ?: string,

			/** Pattern matching, removes files from query based on * and ? syntax. Case sensitive. */
			namePatternExclude ?: string	
		}

		export interface CreateFile {
			file: Buffer,
			filename: string,
			path: string
		}
	}

	export namespace Types {
		export interface ObjectMetadata {
			FullPath: string,
			Mtime: Date,
			Crtime: Date,
			Mode: string,
			Uid: string,
			Gid: string,
			Mime ?: string,
			TtlSec: number,
			UserName: string,
			GroupNames: string | null,
			SymlinkTarget ?: string,
			Md5: string | null,
			Extended: string | null,
		}

		export interface DirectoryMetadata extends ObjectMetadata {
			FileSize: number,
			Rdev: number,
			Inode: number,
			HardLinkId: string | null,
			HardLinkCounter: number,
			Content: string | null,
			Remote: string | null,
			Quota: number
		}

		export interface FileMetadata extends ObjectMetadata {
			Replication: string,
			Collection ?: string,
			chunks: [
				{
					file_id: string,
					size: number,
					mtime: number,
					e_tag: string,
					fid: {
						volume_id: number,
						file_key: number,
						cookie: number
					},
					is_gzipped: boolean
				}
			]
		}

		export interface Tags {
			[key: string]: string
		}
	}

	export namespace Response {
		export interface ListFiles {
			Path: string,
			Entries: (Types.FileMetadata | Types.DirectoryMetadata)[],
			Limit: number,
			LastFileName: string,
			ShouldDisplayLoadMore: boolean
		}

		export interface Create {
			name: string,
			size: number
		}
	}
}

export interface SeaweedFilerConfig {
    host: string,
    port: number,
    https: boolean,
}

/**
 * API endpoints for filer server.
 * 
 * Based on the main repo: https://github.com/seaweedfs/seaweedfs/wiki/Filer-Server-API
 * 
 * Default port is 8888, and host is localhost assuming you are testing locally.
 */
export class SeaweedFilerServer {

	private filerServerURL: string;
	private host: string;
	private port: number;
	private https: boolean;

	constructor(config: SeaweedFilerConfig = {
		host: "localhost",
		port: 8888,
		https: false,
	}) {
		Object.assign(this, config);
		const protocol = this.https ? "https" : "http";
		this.filerServerURL = `${protocol}://${this.host}:${this.port}`;
	}

	/**
		 * Removes all null parameters, only grabs the ones that have some set value as
		 * all methods are either default "" or false.
		 * @param parameters Parameter list provided
		 * @returns URL encoded parameter list as a string
		 */
	private parseParameters(parameters: Filer.Parameters.SeaweedFilerParameters) {
		return Object.entries(parameters).filter(([, val]) => {
			return (val && val != "");
		}).map(([key, val]) => {
			return `${key}${encodeURIComponent(val)}`;
		}).join("&");
	}

	/**
		 * Send provides an interface for uploading a file via POST. The default functionality provided by the
		 * API is to upload a file, but you can customize what happens using the `parameters`. For example,
		 * if you set the parameter `op` to be `append`, it will append the body to the end of the file.
		 * 
		 * e.g. `send(file, { op: "append"});` ==> Appends to the file
		 * 
		 * @param createFile Required file parameters in question
		 * @param parameters Optional URL parameters for additional behaviour
		 * @returns Response from creating an object
		 */
	public send(createFile: Filer.Parameters.CreateFile, parameters?: Filer.Parameters.Post): Promise<Filer.Response.Create> {
		return new Promise((resolve, reject) => {
			const form = new FormData();
			form.append("file", new Blob([createFile.file]), createFile.filename);
				
			const fullURL = `${this.filerServerURL}/${createFile.path}?${this.parseParameters(parameters)}`;
			fetch(fullURL, {body: form, method: "POST"}).then(response => {
				response.json().then(json => resolve(json as Filer.Response.Create));
			}).catch(err => { return reject(err); });
		});
	}

	/**
		 * Alternative method for `send` using PUT instead of POST. Normally just use `send` as there
		 * doesn't appear to be a difference between the two approaches.
		 */
	public put(createFile: Filer.Parameters.CreateFile, parameters?: Filer.Parameters.Post): Promise<Filer.Response.Create> {
		return new Promise((resolve, reject) => {
			const form = new FormData();
			form.append("file", new Blob([createFile.file]), createFile.filename);
				
			const fullURL = `${this.filerServerURL}/${createFile.path}?${this.parseParameters(parameters)}`;
			fetch(fullURL, {body: form, method: "PUT"}).then(response => {
				response.json().then(json => resolve(json as Filer.Response.Create));
			}).catch(err => { return reject(err); });
		});
	}

	/**
		 * Pagination function that queries large directory files so that the user gets all the files.
		 * See the wiki for more information.
		 */
	private async * listAllFiles(url: string, parameters: Filer.Parameters.List) {
		const fullURL = `${url}?${this.parseParameters(parameters)}`;
		const limit = parameters.limit ? parameters.limit : 100;
		let data: Filer.Response.ListFiles;

		do {
			const response = await fetch(fullURL);
			data = await response.json();
			yield data.Entries;
		}
		while(data.Entries.length > limit);
	}

	/**
		 * Lists all files in a directory on the server. Includes subdirectories.
		 * 
		 * Uses pagination to get all of the files using O(log(n)) time.
		 * 
		 * @param path path that you want the information from
		 * @param pretty optional parameters
		 * @returns array of files/objects
		 */
	public async listFiles(path: string, parameters: Filer.Parameters.List): Promise<(Filer.Types.FileMetadata | Filer.Types.DirectoryMetadata)[]> {
		const listFileResponse: (Filer.Types.FileMetadata | Filer.Types.DirectoryMetadata)[] = [];
		for await (const objects of this.listAllFiles(`${this.filerServerURL}/${path}`, parameters)) {
			listFileResponse.push(...(objects ?? []));
		}
		return listFileResponse;
	}

	/**
		 * Gets the metadata for a file or folder
		 * 
		 * @param path path that you want the information from, file or folder.
		 * @param pretty optional parameter if you want to prettify the response
		 * @returns reponse metadata object (file or directory depending on what you are looking for)
		 */
	public getMetadata(path: string): Promise<Filer.Types.FileMetadata | Filer.Types.DirectoryMetadata> {
		return new Promise((resolve, reject) => {
			const parameters = { metadata: true };
			const fullURL = `${this.filerServerURL}/${path}?${this.parseParameters(parameters)}`;
				
			fetch(fullURL).then(response => {
				response.json().then(json => {
					if (!json) resolve(json as Filer.Types.FileMetadata);
					else if(json["chunks"]) resolve(json as Filer.Types.FileMetadata);
					else resolve(json as Filer.Types.DirectoryMetadata);
				});
			}).catch(err => { return reject(err); });
		});
	}

	/**
		 * Sets the tags for a object
		 * @param path Path to the object
		 * @param tags tags that will be added to the object, must be prefixed with `Seaweed-`
		 * @returns Response
		 */
	public setTags(path: string, tags: Filer.Types.Tags): Promise<JSON> {
		return new Promise((resolve, reject) => {
			const invalidTags = Object.entries(tags).filter(([key,]) => {return !key.startsWith("Seaweed-");});
			if(invalidTags.length) return new Filer.Errors.SeaweedInvalidTag(invalidTags);
			return fetch(`${this.filerServerURL}/${path}?tagging`, {
				method: "PUT",
				headers: tags
			}).then(response => response.json())
				.then(json => resolve(json))
				.catch(err => reject(err));
		});
	}

	/**
		 * Moves a file from one spot to another on the server
		 * @param path Original path
		 * @param newPath New Path
		 * @returns Axios request
		 */
	public move(path: string, newPath: string) {
		const fullURL = `${this.filerServerURL}/${newPath}?mv.from=${encodeURIComponent(path)}`;
		return fetch(fullURL, {method: "POST"});
	}

	/**
		 * Removes all tags if none specified, or a subset of tags if tags are provided
		 */
	public removeTags(path: string): Promise<JSON>;
	public removeTags(path: string, tagNames: string[]): Promise<JSON>;
	public removeTags(path: string, tagNames ?: string[]): Promise<JSON> {
		return new Promise((resolve, reject) => {
			const invalidTags = tagNames.filter((key) => {return !key.startsWith("Seaweed-");});
			if(invalidTags.length) return reject(new Filer.Errors.SeaweedInvalidTag(invalidTags));

			const fullURL = `${this.filerServerURL}/${path}?tagging`;
			fetch(`${fullURL}=${tagNames.map(tagName => {return encodeURIComponent(tagName);}).toString()}`, {method: "DELETE"}).then(response => {
				response.json().then(json => {
					resolve(json);
				}).catch(err => reject(err));
			});
		});
	}

	/**
		 * Gets a file from the server
		 * @param path 
		 * @param responseContentDisposition
		 * @returns 
		 */
	public getFile(path: string): Promise<JSON>;
	public getFile(path: string, attachment: boolean): Promise<JSON>;
	public getFile(path: string, attachment: boolean = false): Promise<JSON> {
		return new Promise((resolve, reject) => {
			const parameters: Filer.Parameters.Get = attachment ? {"response-content-disposition": "attachment"} : {};
			const fullURL = `${this.filerServerURL}/${this.parseParameters(parameters)}`;
				
			fetch(fullURL).then(response => {
				response.json().then(json => {
					resolve(json);
				});
			}).catch(err => reject(err));
		});
	}

	public deleteFile(path: string, parameters: Filer.Parameters.Delete): Promise<JSON> {
		return new Promise((resolve, reject) => {
			const fullURL = `${this.filerServerURL}/${path}?${this.parseParameters(parameters)}`;	
			fetch(fullURL, {method: "DELETE"}).then(response => {
				response.json().then(json => {
					resolve(json);
				}).catch(err => reject(err));
			});
		});
	}

}