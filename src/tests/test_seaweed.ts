import { expect } from "chai";
import { describe } from "mocha";
import { SeaweedClient } from "../seaweed";
import { Master } from "../master";
import * as fs from "fs";

describe("SeaweedClient", () => {

	let client: SeaweedClient;
	let file: Buffer;
	let image: Buffer;
	let fileName: string;

	before(async () => {
		client = new SeaweedClient({host: "master", port: 9333});
		file = Buffer.from("CONTENTS");
		image = fs.readFileSync("src/tests/test.jpg");
		fileName = "RANDOMFILE.txt"; 
	});

	it("Can be created and connect", (done) => {
		client.systemHealth().then((response) => {
			expect(response).to.be.eq(200);
			done();
		}).catch(err => done(err));
	});

	describe("parseParameters", () => {

		it("Handles empty entry", (done) => {
			// @ts-expect-error Checking private functions
			const result = client.parseParameters({});
			expect(result).to.be.eq("");
			done();
		});

		it("Handles single parameter", (done) => {
			// @ts-expect-error Checking private functions
			const result = client.parseParameters({fsync: true});
			expect(result).to.be.eq("fsync=true");
			done();
		});

		it("Handles multiple parameters", (done) => {
			// @ts-expect-error Checking private functions
			const result = client.parseParameters({
				fsync: true,
				type: "replicate"
			});
			expect(result).to.be.eq("fsync=true&type=replicate");
			done();
		});
	});

	describe("assign", () => {
		it("assign()", (done) => {
			client.assign().then(result => {
				expect(result).to.not.be.null;
				expect(result.count).to.be.eq(1);
				expect(result.fid).to.not.be.null;
				expect(result.url).to.be.eq("volume:8080");
				expect(result.publicUrl).to.be.eq("localhost:8080");
				done();
			}).catch(err => done(err));
		});
	});

	describe("write", () => {
		let options: Master.Response.Assign;

		before((done) => {
			client.assign().then(result => {
				options = result;
				done();
			}).catch(err => done(err));
		});

		it("Can write a buffer", (done) => {
			client.write({
				fid: options.fid,
				file: file,
				filename: fileName,
				volumeURL: options.url
			}).then(result => {
				expect(result).to.not.be.null;
				expect(result.size).to.be.eq(8);
				expect(result.name).to.be.eq(fileName);
				done();
			}).catch(err => done(err));
		});

		it("Can write a file from disk", (done) => {
			fs.readFile("src/tests/test.txt", "utf8", (err, file) => {
				client.write({
					fid: options.fid,
					file: Buffer.from(file),
					filename: "test.txt",
					volumeURL: options.url
				}).then(result => {
					expect(result).to.not.be.null;
					expect(result.size).to.be.eq(19);
					expect(result.name).to.be.eq("test.txt");
					done();
				}).catch(err => done(err));
			});
		});
	});

	describe("update", () => {
		let options: Master.Response.Assign;
		let newFile: Buffer;
		let newFileName: string;

		before((done) => {
			client.assign().then(result => {
				options = result;
				client.write({
					file: file,
					filename: fileName,
					fid: result.fid,
					volumeURL: result.url
				}).then(() => {
					newFile = Buffer.from("NEWCONTENTS");
					newFileName = "RANDOMFILE2.txt"; 
					done();
				});
			}).catch(err => done(err));
		});

		it("update(options)", (done) => {
			client.update({
				fid: options.fid,
				file: newFile,
				filename: newFileName
			}).then(result => {
				expect(result).to.not.be.null;
				expect(result.size).to.be.eq(11);
				expect(result.name).to.be.eq(newFileName);
				done();
			}).catch(err => done(err));
		});
	});

	describe("delete", () => {
		let options: Master.Response.Assign;

		before((done) => {
			client.assign().then(result => {
				options = result;
				client.write({
					file: file,
					filename: fileName,
					fid: result.fid,
					volumeURL: result.url
				}).then(() => {
					done();
				});
			}).catch(err => done(err));
		});

		it("delete(options)", (done) => {
			client.delete({
				fid: options.fid
			}).then(result => {
				expect(result.size).to.be.eq(34);
				done();
			}).catch(err => done(err));
		});
	});

	describe("get", () => {
		let textFID: string;
		let imgFID: string;

		before((done) => {
			Promise.all([
				client.assign().then(result => {
					textFID = result.fid;
					client.write({
						file: file,
						filename: fileName,
						fid: result.fid,
						volumeURL: result.url
					}).catch(err => done(err));
				}),
				client.assign().then(result => {
					imgFID = result.fid;
					client.write({
						fid: result.fid,
						file: image,
						filename: "test.jpg",
						volumeURL: result.url
					}).catch(err => done(err));
				})
			]);
			done();
		});

		it("Download text as blob", (done) => {
			client.get({fid: textFID}).then((getFile) => {
				getFile.arrayBuffer().then(buffer => {
					expect(Buffer.from(buffer).equals(file)).to.be.true;
					done();
				});
			}).catch(err => done(err));
		});

		it("Download image as blob", async () => {
			const img = await client.get({fid: imgFID});
			const buffer = await img.arrayBuffer();
			expect(Buffer.from(buffer).equals(image)).to.be.true;
		});

		it("Download text as stream", async () => {
			let offset = 0;
			let valid = true;

			for await (const chunk of client.getStream({fid: textFID})) {
				let i = 0;
				for (i; i < chunk.length; i++) {
					if (chunk[i] != file[i + offset]) valid = false;
				}
				offset += i; 
			}
			
			expect(valid).to.be.true;
		});

		it("Get using stream on image", async () => {
			let offset = 0;
			let valid = true;
			for await (const chunk of client.getStream({fid: imgFID})) {
				let i = 0;
				for (i; i < chunk.length; i++) {
					if (chunk[i] != image[i + offset]) valid = false;
				}
				offset += i; 
			}
			expect(valid).to.be.true;
		});
	});

	describe("vaccum", () => {
		it("vaccum()", async () => {
			const result = client.vaccum(0.4);
			expect(result).to.not.be.null;
		});
	});

	describe("systemStatus", () => {
		it("systemStatus()", (done) => {
			client.systemStatus().then(result => {
				expect(result).to.not.be.null;
				done();
			}).catch(err => done(err));
		});
	});

	describe("writableVolumeStatuses", () => {
		it("writableVolumeStatuses()", (done) => {
			client.writableVolumeStatuses().then(result => {
				expect(result).to.not.be.null;
				done();
			}).catch(err => done(err));
		});
	});

	describe("volumeStatuses", () => {
		it("volumeStatuses()", (done) => {
			client.volumeStatuses().then(result => {
				expect(result).to.not.be.null;
				done();
			}).catch(err => done(err));
		});
	});

	describe("lookup", () => {

		let volumeId: number;

		before((done) => {
			client.assign().then(response => {
				client.volumeServerStatus(response.url).then(response => {
					volumeId = response.Volumes[0].Id;
					done();
				});
			});
		});

		it("Handles bad data", (done) => {
			client.lookup({volumeId: -10}).then(() => {
				done("No error thrown when there should have been an error.");
			}).catch(err => {
				expect(err).to.be.instanceOf(Master.Error.NoVolumeFound);
				done();
			});
		});

		it("Handles good data", (done) => {
			client.lookup({volumeId: volumeId}).then(result => {
				expect(result.locations[0].dataCenter).to.be.eq("dc1");
				expect(result.locations[0].url).to.be.eq("volume:8080");
				expect(result.locations[0].publicUrl).to.be.eq("localhost:8080");
				done();
			}).catch(err => {
				done(err);
			});
		});
	});

	describe("volumeServerStatus", () => {
		let url: string;
		before((done) => {
			client.assign().then(response => {
				url = response.url;
				done();
			});
		});

		it("Handles good data (url)", (done) => {
			client.volumeServerStatus(url).then(status => {
				expect(status).to.not.be.null;
				done();
			}).catch(err => {
				done(err);
			});
		});
	});
	
});
