class SeaweedError extends Error {}

export namespace Volume {

	export namespace Error {
		export class DeleteError extends SeaweedError {
			constructor(id: string) {
				super(`Failed to delete item ${id} from seaweed`);
			}
		}
		export class NoFileFoundError extends SeaweedError {
			constructor(id: string) {
				super(`Item ${id} does not exist on seaweed or could not be found`);
			}
		}

		export class NoVolumeServerFoundError extends SeaweedError {
			constructor(id: string) {
				super(`Volume Server ${id} does not exist on seaweed or could not be found`);
			}
		}
	}

	export namespace Headers {
		export enum GetKeys {
			/** Json Web Token for reads issued by master	 */
			Authorization = "Authorization",

			/** for http range request, support multiple ranges	 */
			Range = "Range", 

			/** format "Mon, 02 Jan 2006 15:04:05 GMT", if not modified, return StatusNotModified 304 */
			IfModifiedSince = "If-Modified-Since",

			/** if matches the ETag, return StatusNotModified 304	 */
			IfNoneMatch = "If-None-Match",

			/** compress response by gzip. MUST BE 'gzip' */
			AcceptEncoding = "Accept-Encoding"
		}

		export enum PostKeys {
			/** Json Web Token for writes issued by master */
			Authorization = "Authorization",

			/** verify the uploaded content by MD5. MD5 digest needs to be encoded as base64 string. */
			ContentMD5 = "Content-MD5	",

			/** use the specified content type */
			ContentType = "Content-Type",

			/** compress response by gzip. MUST BE 'gzip' */
			ContentEncoding = "Content-Encoding"

		}

		export type Get = {
			[key in GetKeys] ?: string
		};

		export type Post = {
			[key in PostKeys | string] ?: string
		};

	}

	export namespace Parameters {
		export interface VolumeParameters {}
		
		export interface Post extends VolumeParameters {
			/** if "true", the write will incur an fsync operation	 */
			fsync ?: boolean,

			/** if "replicate", this is a replicated request, so the writes will not be replicated to other volume servers */
			type ?: "replicate",

			/** modification timestamp in epoch seconds */
			ts ?: boolean,

			/** content is a chunk manifest file	 */
			cm ?: boolean
		}

		/**
		 * Possible get request parameters, none are required.
		 */
		export interface Get extends VolumeParameters {
			/** if "true", possibly read a deleted file. Does not work if volume server is restarted or the volume is compacted. */
			readDeleted ?: string,

			/** if the stored file has ".png", ".jpg", ".jpeg", ".gif", apply resizing*/
			width ?: string,

			/** if the stored file has ".png", ".jpg", ".jpeg", ".gif", apply resizing*/
			height ?: string,

			/** if resizing, "fit", or "fill". Or just resizing, unless width==height, which default to thumbnail mode */
			mode ?: "fit" | "fill" | "thumbnail",

			/** if the stored file has ".png", ".jpg", ".jpeg", ".gif", apply cropping, requires: 0 <= value < image width */
			crop_x1 ?: number
			
			/** if the stored file has ".png", ".jpg", ".jpeg", ".gif", apply cropping, requires: 0 <= value < image width */
			crop_y1 ?: number

			/** if the stored file has ".png", ".jpg", ".jpeg", ".gif", apply cropping, requires: 0 <= value < image width */
			crop_x2 ?: number

			/** if the stored file has ".png", ".jpg", ".jpeg", ".gif", apply cropping, requires: 0 <= value < image width */
			crop_y2 ?: number
		}

		export interface File {
			fid: string,
			volumeURL ?: string,
			public ?: boolean
		}

		/**
		 * Parameters for writing a file, will support writing streams
		 * in the future once the fetch API supports streams.
		 */
		export interface WriteFile {
			file: Buffer,
			filename: string,
			fid: string,
			volumeURL: string
		}

		export interface UpdateFile extends File {
			file: Buffer,
			filename: string,
			public ?: boolean
		}

		export interface GetFile extends File {}

		export interface DeleteFile extends File {}
	}

	export namespace Types {
		export interface Volume {
      Id: number,
      Size: number,
      ReplicaPlacement: unknown,
      Ttl: {
				Count: number,
				Unit: number
			},
      DiskType: string,
      Collection: string,
      Version: number,
      FileCount: number,
      DeleteCount: number,
      DeletedByteCount: number,
      ReadOnly: boolean,
      CompactRevision: number,
      ModifiedAtSecond: number,
      RemoteStorageName: string,
      RemoteStorageKey: string
    }

		export interface DiskStatus {
			dir: string,
			all: number,
			used: number,
			free: number,
			percent_free: number,
			percent_used: number
		}
	}

	export namespace Response {

		export interface Write {
			name: string,
			size: string,
			eTag: string
		}

		export interface Update extends Write {}

		export interface Delete {
			size: number
		}

		export interface ServerStatus {
			Version: string,
			DiskStatuses: Types.DiskStatus[],
			Volumes: Types.Volume[]
		}
	}
}