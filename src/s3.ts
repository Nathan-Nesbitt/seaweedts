import { CreateBucketCommand, CreateBucketRequest, DeleteBucketCommand, DeleteObjectCommand, DeleteObjectOutput, DeleteObjectsCommand, DeleteObjectsOutput, GetObjectCommand, GetObjectOutput, HeadBucketCommand, HeadBucketOutput, HeadObjectCommand, HeadObjectOutput, ListBucketsCommand, ListObjectsV2Command, ListObjectsV2Output, PutObjectCommand, PutObjectOutput, S3Client, paginateListObjectsV2 } from "@aws-sdk/client-s3";
import { Readable } from "stream";

/**
 * This is just a dumbed down version of the S3 client provided by Amazon.
 * I just don't wanna write out all that every time, and this covers 99%
 * of cases I normally use.
 * 
 * You can just directly use that API, or you can use this one if you just
 * want the functionality provided by seaweedfs.
 * 
 * This just allows you to have a class and call the methods directly instead
 * of using the S3 syntax.
 */


export class SeaweedS3Client {
	protected client: S3Client;

	constructor(
        protected host: string,
        public defaultBucket: string = null,
        protected port: number = 8333,
        protected https: boolean = false,
	) {
		const endpoint = `http://${this.host}:${this.port}`;
		this.client = new S3Client({
			endpoint: endpoint,
			// specify region since it is mandatory, but it will be ignored by seaweedfs
			region: "us-west-1",
			// force path style for compatibility reasons
			forcePathStyle: true,
			// credentials is mandatory and s3 authorization should be enabled with `s3.configure`
			credentials: {
				accessKeyId: "",
				secretAccessKey: ""
			}
		});
	}

	/**
     * Checks if the connection is alive by checking if there is a bucket.
     * 
     * Promise resolves if there is a connection, fails if there isn't.
     */
	alive(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.listBuckets().then(() => {
				resolve();
			}).catch((error) => {
				reject(error);
			});
		});
	}

	/**
     * Converts a stream returned from S3 to a string. You need to cast to Readable
     * using `Body as Readable` when you pass this in.
     * 
     * @param stream Body as Readable
     * @returns string
     */
	streamToString(stream: Readable): Promise<string> {
		return new Promise((resolve, reject) => {
			const chunks: Uint8Array[] = [];
			stream.on("data", (chunk) => chunks.push(chunk));
			stream.on("error", reject);
			stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		});
	}

	listBuckets() {
		return this.client.send(new ListBucketsCommand({}));
	}

	createBucket(createBucketRequest: CreateBucketRequest) {
		return this.client.send(new CreateBucketCommand(createBucketRequest));
	}

	deleteBucket(bucket: string) {
		return this.client.send(new DeleteBucketCommand({
			Bucket: bucket
		}));
	}

	/**
     * Check if a bucket exists and if you have the right to access it.
     * No parameters is the default butcket.
     * BucketOwner allows you to check if someone else has access
     */
	headBucket(): Promise<HeadBucketOutput>;
	headBucket(bucketName: string): Promise<HeadBucketOutput>;
	headBucket(bucketName: string, expectedBucketOwner: string): Promise<HeadBucketOutput>;
	headBucket(bucketName?: string, expectedBucketOwner?: string): Promise<HeadBucketOutput> {
		return this.client.send(new HeadBucketCommand({
			Bucket: bucketName,
			ExpectedBucketOwner: expectedBucketOwner
		}));
	}

	upload(file: Buffer, filename: string): Promise<PutObjectOutput>;
	upload(file: Buffer, filename: string, bucket: string): Promise<PutObjectOutput>;
	upload(file: Buffer, filename: string, bucket?: string): Promise<PutObjectOutput> {
		return this.client.send(new PutObjectCommand({
			Body: file,
			Bucket: bucket ? bucket : this.defaultBucket,
			Key: filename
		}));
	}

	get(filename: string): Promise<GetObjectOutput>;
	get(filename: string, bucket: string): Promise<GetObjectOutput>;
	get(filename: string, bucket?: string): Promise<GetObjectOutput> {
		return this.client.send(new GetObjectCommand({
			Bucket: bucket ? bucket : this.defaultBucket,
			Key: filename
		}));
	}

	delete(filename: string): Promise<DeleteObjectOutput>;
	delete(filename: string, bucket: string): Promise<DeleteObjectOutput>;
	delete(filename: string, bucket?: string): Promise<DeleteObjectOutput> {
		return this.client.send(new DeleteObjectCommand({
			Bucket: bucket ? bucket : this.defaultBucket,
			Key: filename
		}));
	}

	deleteMany(filenames: string[]): Promise<DeleteObjectsOutput>;
	deleteMany(filenames: string[], bucket: string): Promise<DeleteObjectsOutput>;
	deleteMany(filenames: string[], bucket?: string): Promise<DeleteObjectsOutput> {
		return this.client.send(new DeleteObjectsCommand({
			Bucket: bucket ? bucket : this.defaultBucket,
			Delete: {
				Objects: filenames.map(filename => { return { Key: filename }; })
			},
		}));
	}

	getMetadata(filename: string): Promise<HeadObjectOutput>;
	getMetadata(filename: string, bucket: string): Promise<HeadObjectOutput>;
	getMetadata(filename: string, bucket?: string): Promise<HeadObjectOutput> {
		return this.client.send(new HeadObjectCommand({
			Bucket: bucket ? bucket : this.defaultBucket,
			Key: filename
		}));
	}

	/**
     * Base list method, you have to handle pagination.
     */
	listV2(): Promise<ListObjectsV2Output>;
	listV2(bucket: string): Promise<ListObjectsV2Output>;
	listV2(bucket?: string): Promise<ListObjectsV2Output> {
		return this.client.send(new ListObjectsV2Command({
			Bucket: bucket ? bucket : this.defaultBucket
		}));
	}

	/**
     * Calls the listV2. Handles pagination for you and just returns a list
     * of objects.
     */
	async list(): Promise<unknown[]>;
	async list(bucket: string): Promise<unknown[]>;
	async list(bucket?: string): Promise<unknown[]> {
		const client = this.client;
		const objects = [];
		for await (const result of paginateListObjectsV2({ client }, { Bucket: bucket })) {
			objects.push(...(result.Contents ?? []));
		}
		return objects;
	}


}