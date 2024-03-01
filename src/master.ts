class SeaweedError extends Error {}

export namespace Master {
	
	export namespace Error {
		export class NoVolumeFound extends SeaweedError {
			constructor(id: number) {
				super(`Volume ${id} does not exist on seaweed or could not be found`);
			}
		}
	}

	export namespace Parameters {
		export interface MasterParameters {}
		
		export interface Assign extends MasterParameters {
			count?: number,
			collection?: string,
			dataCenter?: string,
			rack?: string,
			dataNode?: string,
			replication?: Types.SeaweedReplication,
			ttl?: number,
			preallocate?: number,
			memoryMapMaxSizeMb?: number,
			writableVolumeCount?: number,
			disk?: true
		}

		export interface PreAllocateVolumes extends MasterParameters {
			count?: number,
			collection?: string,
			dataCenter?: string,
			rack?: string,
			dataNode?: string,
			replication?: Types.SeaweedReplication,
			ttl?: number,
			preallocate?: number,
			memoryMapMaxSizeMb?: number
		}

		export interface Lookup extends MasterParameters {
			volumeId: number,
			collection ?: string,
			fileId ?: string,
			read ?: boolean
		}
	}

	export namespace Types {
		/**
		 * 000 = No replication
		 * 
		 * 001 = One replication on same rack
		 * 
		 * 010 = One replication on different rack but same data center
		 * 
		 * 100 = Once on a different data center
		 * 
		 * 200 = Twice on two different data centers
		 * 
		 * 110 = Once on different rack, once on a different data center
		 */
		export type SeaweedReplication = "000" | "001" | "000" | "010" | "100" | "200" | "110";

		export interface Topology {
			Datacenters: {
				Free: number,
				Id: string,
				Max: number,
				Racks: {
					DataNodes: {
						Free: number,
						Max: number,
						PublicUrl: string
						Url: string,
						Volumes: number
					}[],
					Free: number,
					Id: string,
					Max: number
				}[],
			}[],
			Free: number,
			Max: number,
			layouts: {
				collection: string,
				replication: SeaweedReplication,
				writables: number[]
			}[]
		}

		export interface DefaultRack {
			[key: string] : {
				Id: number,
				Size: number,
				ReplicaPlacement: {
					SameRackCount: number,
					DiffRackCount: number,
					DiffDataCenterCount: number
				},
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
				ReadOnly: false,
				CompactRevision: number,
				ModifiedAtSecond: number,
				RemoteStorageName: string,
				RemoteStorageKey: string
			}[];
		}
	}

	export namespace Response {
		export interface Assign {
			count: number,
			fid: string,
			url: string,
			publicUrl: string
		}

		export interface VolumeInfo {
			volumeId: string,
			locations: {
				publicUrl: string,
				url: string
			}[]
		}

		export interface Lookup {
			locations: {
				publicUrl: string,
				url: string,
				dataCenter: string
			}[]
		}

		export interface SystemStatus {
			IsLeader: boolean,
			Leader: string,
			Peers: string[]
		}

		export interface WritableVolumeStatus {
			Topology: Types.Topology,
			Version: string
		}

		export interface VolumeStatuses {
			Version: string,
			Volumes: {
				DataCenters: {
					DefaultDataCenter: {
						DefaultRack: Types.DefaultRack;
					}
				}
			},
			Free: number,
			Max: number
		}

		export interface Vaccum {
			Topology: {
				Max: number,
				Free: number,
				DataCenters: {
					Id: string,
					Racks: {
						Id: string,
						DataNodes: {
							Url: string,
							PublicUrl: string,
							Volumes: number,
							EcShards: number,
							Max: number,
							VolumeIds: string
						}[]
					}[]
				}[ ],
				Layouts: {
					replication: Types.SeaweedReplication,
					ttl: string,
					writables: number[],
					collection: string,
					diskType: string
				}[ ]
			},
			Version: string
		}
	}
}