import { expect } from "chai";
import { describe } from "mocha";
import { SeaweedFilerServer } from "../filer";

describe("SeaweedFilerServer", () => {

	let client: SeaweedFilerServer;
	let file: Buffer;
	let filename: string;
	let path: string;

	before(async () => {
		client = new SeaweedFilerServer({host: "filer", port: 8888, https: false});
		file = Buffer.from("CONTENTS");
		filename = "RANDOMFILE.txt";
		path = "files" 
	});

	describe("send", () => {
		it("Creates a single file", async () => {
			const result = await client.send({
				file: file,
				filename: filename,
				path: `${path}/${filename}`
			});
			expect(result.name).to.be.eq(filename);
			expect(result.size).to.be.eq(8);
		});
	});

	describe("getFile", () => {
		it("Gets a file", async () => {
			const fileAsBlob = await client.getFile(`${path}/${filename}`);
			const fileAsArrayBuffer = await fileAsBlob.arrayBuffer();
			expect(Buffer.from(fileAsArrayBuffer).equals(file)).to.be.true;
		});
	});

	describe("put", () => {
		it("Creates a single file", async () => {
			const result = await client.put({
				file: file,
				filename: filename,
				path: `/put/${filename}`
			});
			expect(result.name).to.be.eq(filename);
			expect(result.size).to.be.eq(196);
		});
	});

	describe("move", () => {
		it("Moves a single file", async () => {
			const result = await client.move(`${path}/${filename}`, `${path}/${filename}.tmp`);
			expect(result.status).to.be.eq(204);
			const resultNew = await client.move(`${path}/${filename}.tmp`, `${path}/${filename}`);
			expect(resultNew.status).to.be.eq(204);
		});
	});

	describe("list", () => {
		it("Handles a single file", async () => {
			const result = await client.list(`${path}`);
			result.files.forEach(file => {
				if (file.FullPath == `/${path}/${filename}`) {
					expect(file.chunks).to.not.be.eq(null);
				}
			})
		});

		it("Handles a directory", async () => {
			const result = await client.list(`${path}`);
			result.files.forEach(file => {
				if (file.FullPath == `/${path}`) {
					expect(file.chunks).to.be.eq(null);
				}
			})
		});
	});

	describe("getDirectoryMetadata", () => {
		it("Gets the metadata for a file", async () => {
			const result = await client.getDirectoryMetadata(`${path}`);
			expect(result.FullPath).to.be.eq(`/${path}`);
		});
	});

	describe("getFileMetadata", () => {
		it("Gets the metadata for a file", async () => {
			const result = await client.getFileMetadata(`${path}/${filename}`);
			expect(result.FullPath).to.be.eq(`/${path}/${filename}`);
		});
	});

	describe("delete", () => {
		it("Deletes a file", async () => {
			const response = await client.delete(`${path}/${filename}`);
			expect(response.status).to.be.eq(204);
		});

		it("Deletes a folder recursively, ignoring warnings about non-empty children.", async () => {
			const response = await client.delete(`${path}`, { recursive: true , ignoreRecursiveError: true});
			expect(response.status).to.be.eq(204);
		});
	});
});
