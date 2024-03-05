# SeaweedTS

Client library for SeaweedFS, providing typing which did not previously exist.

**This library requires Node version >18 as it uses fetch**

## How to use

- `src/seaweed` contains the master / volume class, handles the core logic
- `src/S3` contains a basic implementation of the S3 classes and interfaces
- `src/master` contains the interfaces for the master node
- `src/volume` contains the interfaces for the child nodes
- `src/filer` contains filer specific classes and interfaces

Depending on what you're trying to connect to or manage, choose the product based on
the name. Normally you want to use the main `SeaweedClient` which can be imported as
follows:

```ts
import { SeaweedClient } from "seaweedts"; 

const seaweed = new SeaweedClient({
  host: "localhost",
  port: 9333
});
```

If we are going to write, we always need to hit the `assign` endpoint
which essentially just tells us where and what to write to.

```ts
import { SeaweedClient } from "seaweedts"; 

const seaweed = new SeaweedClient();
seaweed.assign().then(response => {
  // Your code in here
})
```

If you want to set the replication or other parameters for the object, you do it here:

```ts
import { SeaweedClient } from "seaweedts"; 

const seaweed = new SeaweedClient();
// No replication = 000
seaweed.assign({ replication: "000" }).then(response => {
  // Your code in here
})
```

You can then run queries on the master/volumes by running the commands. For example,
if you want to write a value, you can call:

```ts
import { SeaweedClient } from "seaweedts"; 

const seaweed = new SeaweedClient();
seaweed.assign().then(response => {
  const file = new Buffer.from("1234");
  const fileName = "file.txt";
  seaweed.write({
    file: file, // What you are writing
    filename: fileName, // New name of the object
    fid: response.fid, // The server defined file ID (volume/id)
    volumeURL: response.url // Where we are going to send the file (defined from the master node)
  });
})
```

It takes in a buffer as the writable object, so if you want to
read a file from memory you simply need to do the following:

```ts
import { SeaweedClient } from "seaweedts"; 

const seaweed = new SeaweedClient();
seaweed.assign().then(response => {
  const file = fs.readFileSync("<LINK TO YOUR FILE>");
  const fileName = "file.txt";
  seaweed.write({
    file: file, // Buffer of What you are writing
    filename: fileName, // New name of the object
    fid: response.fid, // The server defined file ID (volume/id)
    volumeURL: response.url // Where we are going to send the file (defined from the master node)
  });
})
```

If you want to read that file back, we take a similar process. For example,
writing a buffered response to a file:

```ts
import { SeaweedClient } from "seaweedts"; 

// Previously defined fid, stored in a DB
var fid;

client.get({fid: fid}).then(async (file) => {
  fs.writeFileSync(`<NEW_FILE>`, new Uint8Array(await file.arrayBuffer()));
}).catch(err => done(err));
```

The default response is a BLOB of the file. If we want to handle a
stream, we can use the following syntax which writes a stream of
data to a file.

```ts
import { SeaweedClient } from "seaweedts"; 

// Previously defined fid, stored in a DB
var fid;

const seaweed = new SeaweedClient();

var writeStream = fs.createWriteStream(`<NEW_FILE>`);
for await (const chunk of client.getStream({fid: fid})) {
  writeStream.write(chunk);
}
writeStream.close();
```

## Testing

You can build the image by running `docker build . --tag seaweedts`

You can run `docker-compose -f seaweedfs.dev.yml up -d` if you want to run the retry
test framework.

It loads up all of the requirements, which is essentially:

- 1 master node
- 1 volume node mounted in docker
- 1 filer node
- 1 S3 node
- 1 webdav node (No libraries for this, I just included it to test visually)

Then it runs the test suite with a sleep method every 15 seconds if it can't 
connect to the master node on localhost:8333

# Creating a new version

## Overview 

Since all the deployment is automated, you just need to tag your branch, and make sure
that the `package.json` is the same (current + 1).

We then commit the change. To tag the branch, you can simply do 

```sh
git tag VERSION
```

The version follows the syntax of vA.B.C where:

- `A` - Major release. New features. Introduces breaking changes from previous version.
- `B` - Minor release. New features. No breaking changes from previous version.
- `C` - Minor release. Bug fix. No breaking changes from previous version.

You can then just push the version change to master.

We can just make changes until a specified date, e.g. each month, then do the change in
a single commit where we increment and publish. This way `master` stays up to date, and we can
just deploy the known functional changes to NPM.

## Example

If you are dealing with version `1.0.0` of the library, and you introduce a small bug
fix or documentation change that should be pushed to the NPM library, you can run the
following as we are not breaking any changes. We can create a new PR


and we want to increment the `C` value by 1 and push to origin:

```sh
git add .
git commit
git tag v1.0.1
git push
```