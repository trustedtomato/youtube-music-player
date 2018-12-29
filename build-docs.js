const fs = require('fs-extra');
const {join} = require('path');
const {exec} = require('child_process');

const source = join(__dirname, 'dist');
const target = join(__dirname, 'docs');

exec('npm run build', err => {
	if(err) throw err;
	fs.copySync(source, target);
});
