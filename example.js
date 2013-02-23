/**
Copyright (C) 2013  Rodrigo J. Polo - http://rodrigopolo.com
  
  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU General Public License
  as published by the Free Software Foundation; either version 2
  of the License.
  
  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.
  
  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
 

// Load Task Master Module
var taskMaster = require('ttMaster');
var program = require('commander');

program
  .version('1.0.1')
  .option('-v, --verbose', 'set the crawler to output a lot of information')
  .option('-u, --user [type]', 'set the desired user to download')
  .parse(process.argv);


// Twitter Tool Config
var tMaster;
var config = {
	MySQL: {
		host			: 'HOST',
		user			: 'USER',
		password		: 'PASS',
		database		: 'MySQLDB'
	},
	Twitter: {
		consumer_key	: 'KEY',
		consumer_secret	: 'SECRET'
	}
}


if(program.user){
	if (program.verbose){
		console.log('Verbose mode on.');
	}
	tMaster = new taskMaster(config);
	tMaster.getUser(program.user);
	process.stdin.destroy();
}else{
	console.log('No user defined, please type one or prec [CTRL]+[C] to canel.');

	program.prompt('Username: ', function(name){
		if(name=='no' || name=='n'){
			process.stdin.destroy();
		}else{
			tMaster = new taskMaster(config);
			tMaster.getUser(program.user);
			process.stdin.destroy();
		}
	});
}


