import { expect } from "chai";
import { describe } from "mocha";
import { SeaweedS3Client } from "../s3";
import { Readable } from "stream";

describe("SeaweedS3Client", () => {

	let client: SeaweedS3Client;
	let file: Buffer;
	let fileName: string;

	before(async () => {
		client = new SeaweedS3Client("s3", "test");
		file = Buffer.from("CONTENTS");
		fileName = "RANDOMFILE.txt"; 
	});

	it("Can be created and connect", (done) => {
		// @ts-expect-error checking protected variables
		expect(client.client).to.not.be.null;
		client.alive().then(() => {
			done();
		}).catch(err => done(err));
	});

	describe("listBuckets", () => {
		it("listBuckets()", (done) => {
			client.listBuckets().then(result => {
				expect(result.Buckets?.length).to.be.gt(0);
				done();
			}).catch(err => done(err));
		});
	});

	describe("upload", () => {
		it("upload(file, filename)", (done) => {
			client.upload(file, fileName).then(() => {
				done();
			}).catch(err => done(err));
		});
	});

	describe("get", () => {
		it("get(filename)", (done) => {
			client.get(fileName).then(newFile => {
				expect(newFile.Body).to.not.be.null;
				client.streamToString(newFile.Body as Readable).then(stringBody => {
					expect(stringBody).to.eq(file.toString());
					done();
				}).catch(err => done(err));
			}).catch(err => done(err));
		});
	});

	describe("delete", () => {
		it("delete(filename)", (done) => {
			client.delete(fileName).then(result => {
				expect(result.DeleteMarker).to.be.eq(undefined);
				done();
			}).catch(err => done(err));
		});
	});
      
	describe("deleteMany", () => {

		const fileNames = ["1", "2", "3"];

		before((done) => {
			Promise.all(fileNames.map(fileName => {
				return client.upload(Buffer.from(""), fileName);
			}));
			done();
		});

		it("deleteMany(fileNames)", (done) => {
			client.deleteMany(fileNames).then(result => {
				expect(result.Errors).to.be.eq(undefined);
				done();
			}).catch(err => done(err));
		});
	});

	after(() => {
		// @ts-expect-error protected accessor, bypass to clean up
		client.client.destroy();
	});
});
