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

// Load MySQL Library
var mysql   = require('mysql');

// Load Twitter library
var Twit = require('twit'); // before just twit

// Load the module
var color = require("ansi-color").set;

// MySQL Connection
var conn;



// task master init
var ttMaster = function (config) {

  // save config
  this.config = config;

  // Connect to MySQL
  conn = mysql.createConnection(this.config.MySQL);
  conn.connect();

  // set default values
  this.studyId = 0;
  this.folIdsCursor = '';
  this.twUsrId = 0;
  this.totalTasks = 0;
  this.aviableMinions = 0;
  this.minions={};
  
  // TEMP STUFF >
  this.resetAccounts();

};


ttMaster.prototype = {
  getUser: function (screen_name) {



    var $this = this;
    //console.log('looking for user:'+screen_name);

    $this.initMinions(function(){
      
      $this.getAvMinion('rem_usr_lup', function(minion_id){
        $this.minions['m'+minion_id].lookUpUser(screen_name,function(json_user){
          if(json_user){
            // save user and get the id
            $this.storeMainUser(json_user,function(studyId){
              // Store the Study ID and Twitter User ID into memory
              $this.studyId = studyId;
              $this.twUsrId = json_user.id_str;
              // Repor to Sys
              sout('Twitter user "'+color(json_user.screen_name, "white+bold")+'" ('+json_user.id_str+') added to MySQL with the id: '+studyId+'.');
              sout('Aprox. '+(Math.ceil(json_user.followers_count/5000)+Math.ceil(json_user.followers_count/100))+' Twitter API calls.');
              json_user.followers_count
              // Lets Rock
              $this.getFollowersIds($this.folIdsCursor);

            });
          }else{
            serr('user not found.');
          }
        });
      });
    });

  },

  initMinions: function (callback) {
    //console.log('minions on');
    var $this = this;
    // Select available accounts
    sql="SELECT `id`, `oauth_token`, `oauth_token_secret` FROM `twitter_accounts` WHERE `busy` =0;";
    query(sql,function(rows){
      $this.aviableMinions = rows.length;
      // Create Minions
      rows.forEach(function (row, index, array) {
        //$this.minions.push(new ttMinion(row,$this.config.Twitter));
        $this.minions['m'+row.id] = new ttMinion(row,$this.config.Twitter);
      });
      // Check minion limits for followers
      $this.checkTwLimits(function(){
        // ok
        callback();
      });

    });
  },

  checkTwLimits: function (callback) {
    var $this = this;
    for (var key in $this.minions) {
      var minion = $this.minions[key];
      minion.checkLimit(function(){
        $this.checkTwLimitsDone(callback);
      });
    }

  },
  checkTwLimitsDone: function (callback) {
    var $this = this;
    sql="SELECT * FROM `twitter_accounts` WHERE  `busy` =0;";
    query(sql,function(rows){
      sout('Checking rate limit for Twitter Minion '+rows.length+' of '+$this.aviableMinions+'.');
      if($this.aviableMinions == rows.length){
        callback();
      }
    });
  },
  getAvMinion: function (kind, callback) {

    var $this = this;
    sql = 'SELECT `id`, `rem_fol_ids`, `rem_usr_lup`, `release` FROM `twitter_accounts` WHERE `busy` =0 ORDER BY `'+kind+'` DESC  LIMIT 1;' //`release` DESC,
    query(sql,function(rows){

      if(rows.length==0){
        sout('No accounts available, retry in 3 secs.');
        setTimeout(function(){
          $this.getAvMinion(kind, callback);
        }, 3*1000);  
      }

      // if there are accounts available
      if(rows.length==1){
        // select current account/minion
        curr_minion = rows[0];
        // Prevent API overload
        if(curr_minion[kind]<=1){
          reset_at = (curr_minion.release - nowUnix());
          sout(curr_minion.id+":\tRate limited, will be free in "+reset_at.toHHMMSS()+' at '+timeOffst(curr_minion.release,-6)+'.');
          // run callback when stop waiting
          setTimeout(function(){
            callback(curr_minion.id);
          }, reset_at*1000);
        }else{
          callback(rows[0].id);
        }
      }
    });
  },
  resetAccounts: function () {
    sql = 'UPDATE `twitter_accounts` SET `busy` = 0;'
    query(sql,function(rows){});
  },
  storeMainUser: function (user,callback) {
    var sql = '';
    var nl = "\n";
    var tab = "\t";
    sql += 'INSERT INTO `twitter_user` ('+nl;
    sql += tab+'`tuser_id`'+nl;
    sql += tab+',`screen_name`'+nl;
    sql += tab+',`start`'+nl;
    sql += tab+',`requests`'+nl;
    sql += tab+',`user_full_json`'+nl;
    sql += ') VALUES ( '+nl;
    sql += tab+user.id_str+nl;
    sql += tab+','+sj(user.screen_name)+nl;
    sql += tab+',UTC_TIMESTAMP()'+nl;
    sql += tab+',1'+nl;
    sql += tab+','+sj(JSON_stringify(user))+nl;
    sql += ');';
    query(sql,function(rows){
      callback(rows.insertId);
    });
  }, 
  getFollowersIds: function () {
    var $this = this;

    $this.getAvMinion('rem_fol_ids', function(minion_id){
      sout('Request user ids to Twitter API.');
      $this.minions['m'+minion_id].getFolIds($this.twUsrId,$this.folIdsCursor,function(jsonIds){
        if(jsonIds){

          // insert the ids into MySQL
          $this.createFollowers(jsonIds.ids,function(){
            sout('IDs Inserted.');

            if(jsonIds.next_cursor_str.length>1){
              // update cursor
              $this.folIdsCursor = jsonIds.next_cursor_str;
              // loop
              $this.getFollowersIds($this.folIdsCursor);
            }else{
              $this.createTasks(function(){
                $this.getThoFollowers();
              });
            }

          });
        }else{
          // loop if cursor
          $this.getFollowersIds($this.folIdsCursor);
        }
      });
    });
  },
  createFollowers: function (ids,callback) {
    var $this = this;
    ids.forEach(function (tuId, index, array) {
      sql = 'INSERT INTO `twitter_followers` (`stid`, `tuser_id`) VALUES ('+$this.studyId+', '+tuId+');';
      query(sql,function(rows){});
    });
    callback();
  },
  createTasks: function (callback) {
    var $this = this;
    sout('Creating Tasks.');
    sql = 'CALL createTasks('+$this.studyId+');';
    query(sql,function(rows){
      sout('Tasks creation done.');
      callback();
    });
  },
  getThoFollowers: function () {
    var $this = this;

     // count total tasks and store in memory
    $this.getPendingTasks(function(totalTsks){
      $this.totalTasks = totalTsks;

        for (var key in $this.minions) {
          var minion = $this.minions[key];
          minion.getFollowers($this.studyId, function(){
            $this.checkFollowersProgress();
          });
        }

    });  

  },
  getPendingTasks: function (callback) {
    var $this = this;
    sql = 'SELECT count(id) as ttotal FROM `twitter_thu_taks` WHERE `stid` = '+$this.studyId+' AND `done` = 0;';
    query(sql,function(rows){
      callback(parseInt(rows[0].ttotal));
    });
  },
  checkFollowersProgress: function () {
    var $this = this;
    $this.getPendingTasks(function(pendingTasks){
      //console.log('Total Tasks: ' + $this.totalTasks);
      //console.log('Pending Tasks: ' + pendingTasks);
      //console.log('Done Tasks: ' + ($this.totalTasks-pendingTasks));

      donet = $this.totalTasks-pendingTasks;
      perc = ((donet / $this.totalTasks)*100).toFixed(2);

      sout(color(perc+'% - ('+donet+' of '+$this.totalTasks+').', "green"));
      if(pendingTasks == 0){

        // marcar hora de terminado en user
        $this.updateDone($this.studyId);
        
        setTimeout(function(){
      process.stdin.destroy();
          sout(color("Done! ;-)\t", "green+bold"));
          die();
        }, 2000);

      }else{
        // nada
      }
    });

  },
  updateDone: function (studyId) {
    sql = 'UPDATE `twitter_user` SET `stop` = UTC_TIMESTAMP() WHERE `id` ='+studyId+';'
    query(sql,function(rows){});
  },
  end: function (param,callback) {
    conn.end();
  }
};






// Twitter Account Minion
var ttMinion = function (me,Tw) {
  this.config = me;
  this.id = me.id;
  this.T = new Twit({
    consumer_key:           Tw.consumer_key,
    consumer_secret:        Tw.consumer_secret,
    access_token:           me.oauth_token,
    access_token_secret:    me.oauth_token_secret 
  });
};

ttMinion.prototype = {
  setBusy: function () {
    sql = 'UPDATE `twitter_accounts` SET `busy` = 1 WHERE `id` = '+this.config.id+';'
    query(sql,function(rows){
      // result
    });
  },

  setFree: function (rel, freq, ureq) {

    relsq  = (rel <0 || rel ==undefined)?'':', `release` = '+rel;
    freqsq = (freq<0 || freq==undefined)?'':', `rem_fol_ids` = '+freq;
    ureqsq = (ureq<0 || ureq==undefined)?'':', `rem_usr_lup` = '+ureq;

    sql = 'UPDATE `twitter_accounts` SET `busy` = 0'+relsq+freqsq+''+ureqsq+' WHERE `id` = '+this.config.id+';';
    query(sql,function(rows){
      // result
    });
  },

  checkLimit: function (callback) {
    var $this = this;
    $this.setBusy();
    $this.T.get('application/rate_limit_status', {}, function(err, reply, headers) {

      todoNext = $this.chkErr(err);
      if(todoNext==1){
        fol = reply.resources.followers['/followers/ids'];
        usr = reply.resources.users['/users/lookup'];
        $this.setFree(usr.reset, fol.remaining, usr.remaining);
        callback();
      }
      if(todoNext==3){
        $this.setFree(-1, -1, -1);
        callback();
      }
      if(todoNext==2){
        // loop to retry
        $this.checkLimit(callback);
      }
    });
  },

  chkErr: function (err) {
    if(err){
      if(err.code){
        if(err.code=='ECONNRESET'){
          sout(color(this.id+":\tTwitter API ECONNRESET error.", "yellow"));
          return 2;
        }
      }
      if(err.statusCode){
        if(err.statusCode==404){
          sout(color(this.id+":\tTwitter API 404 error.", "yellow"));
          return 3;
        }
        if(err.statusCode==502){
           sout(color(this.id+":\tTwitter API 502 error.", "yellow"));
          return 2;
        }
        sout(color(this.id+":\tTwitter API:"+err.statusCode, "yellow"));
        /*sout('>>>');
        sout(JSON_stringify(err));
        sout('<<<');*/
        return 2;
      }else{
        sout(color(this.id+":\tTwitter API - Unknown.", "yellow"));
        /*sout('>>>');
        sout(JSON_stringify(err));
        sout('<<<');*/
        return 2;
      }
    }else{
      return 1;
    }
  },

  lookUpUser: function (usersn,callback) {
    var $this = this;
    $this.setBusy();
    $this.T.get('users/lookup', {
      screen_name: usersn,
      include_entities:true
    }, function(err, reply, h) {

      todoNext = $this.chkErr(err);

      if(todoNext==1){
        $this.setFree(h['x-rate-limit-reset'], -1, h['x-rate-limit-remaining']);
        callback(reply[0]);
      }
      if(todoNext==3){
        $this.setFree(-1, -1, -1);
        callback(false);
      }
      if(todoNext==2){
        // loop to retry
        $this.lookUpUser(usersn,callback);
      }

    });
  },

  getFolIds: function (twusrid,dcursor,callback) {
    var $this = this;

    if(dcursor.length<1){
      req_params={
        user_id:  twusrid
      }
    }else{
      req_params={
        user_id:  twusrid,
        cursor:   dcursor
      }
    }

    $this.setBusy();
    $this.T.get('followers/ids', req_params, function(err, reply, h) {

      todoNext = $this.chkErr(err);

      if(todoNext==1){
        //console.log($this.config.id+':Check-> '+h['x-rate-limit-reset']+' - '+h['x-rate-limit-remaining']);
        $this.setFree(h['x-rate-limit-reset'], h['x-rate-limit-remaining'],-1);
        callback(reply);
      }
      // if any kind of failure the task master should relocate the task to the best available minion
      if(todoNext==3 || todoNext==2){
        $this.setFree(-1, -1, -1);
        callback(false);
      }

    });
  },


  getFollowers: function (studyId, callback) {
    var $this = this;

    //console.log($this.id+' dice Iniciando para: '+studyId);

    // get a free task
    $this.getFreeTask(studyId, function(freeTask){
      //console.log($this.id+' dice freeTask para: '+studyId);

      // set busy
      $this.setBusy();

      // request to twitter api
      $this.T.get('users/lookup', {
        user_id: freeTask.ids,
        include_entities:true
      }, function(err, reply, h) {

        todoNext = $this.chkErr(err);

         // if success, enter to db, mark task as done, set free, callback
        if(todoNext==1){
          //console.log($this.id+' dice que todo bien.');
          // store on DB function AND EXTRACT KEYWORDS ------------------------------------------------------------------------
          reply.forEach(function (twuser, index, array) {
            $this.updateFollower(twuser,studyId);
          });


          // mark task as NOT busy and done
          $this.setTaskDone(freeTask.work_id,function(){

            //console.log($this.id+' dice LIBERAR - Rate: ' + h['x-rate-limit-reset'] + ' - LimitRem: ' + h['x-rate-limit-remaining']);
            $this.setFree(h['x-rate-limit-reset'],-1, h['x-rate-limit-remaining']);

            // prevent overuse
            if(h['x-rate-limit-remaining']!= undefined){
              if(h['x-rate-limit-remaining']<=1){

                reset_at = (parseInt(h['x-rate-limit-reset']) - nowUnix());

                //console.log($this.id+' dice que solo le queda 1 y setea a: '+reset_at); 
                setTimeout(function(){
                  $this.getFollowers(studyId, callback);
                }, reset_at*1000);  

              }else{
                // loop
                //console.log($this.id+' dice que header definido y mayor que 1.');
                $this.getFollowers(studyId, callback);
                callback();
              }
            }else{
              // loop
              $this.getFollowers(studyId, callback);
              callback();
            }
            
          });


        }

        // if not, mark task as free task and callback to prevent account issues
        if(todoNext==2){
          // set task free and NOT done
          $this.resetTask(freeTask.work_id,function(){
            // set minion free
            $this.setFree(-1, -1, -1);

            // loop
            $this.getFollowers(studyId, callback);

            callback();
          });
        }

        // not found, mark as done but stay busy, callback
        if(todoNext==3){
          // set task free and NOT done
          $this.setTaskPending(freeTask.work_id,function(){
            // set minion free
            $this.setFree(-1, -1, -1);

            // loop
            $this.getFollowers(studyId, callback);

            callback();
          });
        }

      });

    });




  },

  getFreeTask: function (stId, callback) {
    var $this = this;
    sql = 'CALL getFree('+stId+');';
    query(sql,function(rows){
      res = rows[0][0]; // work_id ids
      // if it is 0 there are not works, so it is done!
      if(res.work_id>0){
        callback(res);
      }
      
    });
  },

  // Putting The Icing On The Cake ;-)
  updateFollower: function (user,studyId) {
    var $this = this;
    var sql = '';
    var nl = "\n";
    var tab = "\t";
    var active = true;
    var plainTextTW='';

    sql += 'UPDATE `twitter_followers`'+nl;
    sql += 'SET'+nl;
    sql += tab+'`protected` = '+user.protected+nl;
    sql += tab+',`created_at` = '+sj(twit_date(user.created_at))+nl;
    sql += tab+',`statuses_count` = '+user.statuses_count+nl;
    sql += tab+',`followers_count` = '+user.followers_count+nl;
    sql += tab+',`friends_count` = '+user.friends_count+nl;
    sql += tab+',`listed_count` = '+user.listed_count+nl;
    sql += tab+',`favourites_count` = '+user.favourites_count+nl;
    sql += tab+',`screen_name` = '+sj(user.screen_name)+nl;
    sql += tab+',`name` = '+sj(user.name)+nl;
    sql += tab+',`description` = '+sj(user.description)+nl;
    sql += tab+',`profile_image_url` = '+sj(user.profile_image_url)+nl;
    sql += tab+',`url` = '+sj(user.url)+nl;
    sql += tab+',`location` = '+sj(user.location)+nl;
    sql += tab+',`time_zone` = '+sj(user.time_zone)+nl;
    sql += tab+',`utc_offset` = '+sj(user.utc_offset)+nl;

    // extract geo-lat-lng from location
    if(user.location){
      if(matches=user.location.match(/([0-9.-]+).+?([0-9.-]+)/)){
        if(matches.length==3){
          ulat=parseFloat(matches[1]);
          ulng=parseFloat(matches[2]);
          if(!isNaN(ulat) && !isNaN(ulng)){
            if(ulat>= -90 && ulat <= 90 && ulng >= -180 && ulng <= 180){
              // si tiene coordenadas
              sql += tab+',`nlat` = '+ulat+nl;
              sql += tab+',`nlng` = '+ulng+nl;
              if(isInPolygon(ulat, ulng, polyCountryGuate)){
                // Guate
                sql += tab+',`ncountry` = '+"'Guatemala GPS_FL'"+nl;
              }
            }
          }
        }
      }
    }

    // check if it has an status
    if(user.status){
      plainTextTW = tweetPlain(user.status.text, user.status.entities);

      sql += tab+',`lt_created_at` = '+sj(twit_date(user.status.created_at))+nl;
      sql += tab+',`lt_id` = '+user.status.id_str+nl;
      sql += tab+',`lt_source_text` = '+strip_html(sj(user.status.source))+nl;
      sql += tab+',`lt_source_url` = '+sj(find1stURL(user.status.source))+nl;
      sql += tab+',`lt_htmltext` = '+sj(plainTextTW)+nl;

      // get geoloc from status
      if(user.status.geo){
        if(user.status.geo.coordinates.length==2){
          ulat=user.status.geo.coordinates[0];
          ulng=user.status.geo.coordinates[1];
          if(!isNaN(ulat) && !isNaN(ulng)){
            if(ulat>= -90 && ulat <= 90 && ulng >= -180 && ulng <= 180){
              // si tiene coordenadas
              sql += tab+',`nlat` = '+ulat+nl;
              sql += tab+',`nlng` = '+ulng+nl;
              if(isInPolygon(ulat, ulng, polyCountryGuate)){
                // Guate
                sql += tab+',`ncountry` = '+"'Guatemala GPS_FS'"+nl;
              }
            }
          }
        }
      }

      // more than two months without tweeting
      if(elapsedDays(user.status.created_at)>60){
        active = false;
      }

    }

    if(user.statuses_count<10 || user.followers_count<10){
      active = false;
    }


    // active users
    if(active){
      sql += tab+',`inactivo` = 0'+nl;;
    }else{
      sql += tab+',`inactivo` = 1'+nl;;
    }

    // full json object
    sql += tab+',`user_full_json` = '+sj(JSON_stringify(user))+nl;
    sql += 'WHERE'+nl;
    sql += tab+'`stid` ='+studyId+nl;
    sql += tab+'AND `tuser_id` = '+user.id_str+';'+nl;

    query(sql,function(rows){
      // add cloudtags
      $this.addCloudTag(plainTextTW,studyId);
      //callback();
    });
    

  },

  setTaskDone: function (taskId, callback) {
    sql = 'UPDATE `twitter_thu_taks` SET `busy` =0, `done` =1 WHERE `id` ='+taskId+';';
    query(sql,function(rows){
      callback();
    });
  },

  setTaskPending: function (taskId, callback) {
    sql = 'UPDATE `twitter_thu_taks` SET `busy` =1, `done` =1 WHERE `id` ='+taskId+';';
    query(sql,function(rows){
      callback();
    });
  },

  resetTask: function (taskId, callback) {
    sql = 'UPDATE `twitter_thu_taks` SET `busy` =0, `done` =0 WHERE `id` ='+taskId+';';
    query(sql,function(rows){
      callback();
    });
  },
  addCloudTag: function (s,study) {
    tags = cloudtagExtractor(s);
    for(var word in tags){
      sql = "CALL cloudTagInsert("+study+",'"+word+"',"+tags[word]+");";
    }
    query(sql,function(rows){
      // nada
    });
  }
}


//export handle
module.exports = ttMaster;



/***
 *
 * Functions
 *
 ***/


// MySQL Query Function
var query = function (sql,callback) {
  conn.query(sql, function(err, rows, fields) {
    if (err){
      serr("MySQL says: \n"+err+"\nQuery:\n"+sql+"\n\n");
    }else{
      callback(rows);
    }
  });
}

// kill connection
var dead = false;
die = function () {
  if(!dead){
    dead = true;
    conn.end();
  }
}

// stdout 
var sout = function (s) {
  process.stdout.write(s+"\n");
}

// stderr
var serr = function (s) {
  process.stderr.write(color("Error: ", "red+bold")+s+"\n");
}

// required to match geoloc
var geolib = require('geolib');

// Check if a lat-lng is inside a polygon
function isInPolygon(lat,lon,poly){
  return geolib.isPointInside({latitude: lat, longitude: lon}, poly);
}

// Guatemala Country Polygon Array
var polyCountryGuate = [{latitude:17.81585431079451,longitude:-89.15260567494511},{latitude:17.81397964484982,longitude:-90.98421843261708},{latitude:17.25594881996876,longitude:-90.98461568989858},{latitude:17.2502201658898,longitude:-91.43395125556131},{latitude:17.21465371748363,longitude:-91.42110410588379},{latitude:17.20311142329556,longitude:-91.37597583018274},{latitude:17.16173826192841,longitude:-91.34765574337384},{latitude:17.18283994303544,longitude:-91.30116330346858},{latitude:17.16673959822474,longitude:-91.26684359335953},{latitude:17.12216712557903,longitude:-91.27276447601852},{latitude:17.09858090213422,longitude:-91.2477351843181},{latitude:17.05281578586151,longitude:-91.20858405547139},{latitude:17.01149660791378,longitude:-91.16794523614553},{latitude:16.99989517287636,longitude:-91.12439068583666},{latitude:16.97761254483044,longitude:-91.12425828382426},{latitude:16.96589637938805,longitude:-91.09779337939473},{latitude:16.9230218703201,longitude:-91.06338852693162},{latitude:16.89926112563721,longitude:-91.06014431095949},{latitude:16.88174719265178,longitude:-91.00417620364787},{latitude:16.86252674754687,longitude:-90.98389205256977},{latitude:16.85679514860678,longitude:-90.94351686848094},{latitude:16.82275070701604,longitude:-90.91539631168833},{latitude:16.81692793854891,longitude:-90.86197815160462},{latitude:16.79763027989088,longitude:-90.85565159535427},{latitude:16.79188972117794,longitude:-90.8028272353277},{latitude:16.77112588919105,longitude:-90.79340579044782},{latitude:16.75640780925886,longitude:-90.75920236759374},{latitude:16.73720107262591,longitude:-90.73274258250996},{latitude:16.71353786788712,longitude:-90.70627116754804},{latitude:16.69869913379534,longitude:-90.70310409698499},{latitude:16.67204324430054,longitude:-90.68283184914972},{latitude:16.64242505860812,longitude:-90.66100577606616},{latitude:16.62014450385281,longitude:-90.66401262186395},{latitude:16.5949348181602,longitude:-90.65616057698902},{latitude:16.58598297957265,longitude:-90.66851827995176},{latitude:16.57564795762186,longitude:-90.65298277597135},{latitude:16.58905737623362,longitude:-90.63909437793632},{latitude:16.57426237377841,longitude:-90.62509595602531},{latitude:16.55786315348873,longitude:-90.64516733454718},{latitude:16.52668036713999,longitude:-90.64814134985251},{latitude:16.51185348751077,longitude:-90.64343825621198},{latitude:16.51642211317919,longitude:-90.61093908457191},{latitude:16.49712566955154,longitude:-90.61086780321652},{latitude:16.47924733402543,longitude:-90.62937912869707},{latitude:16.47929156660186,longitude:-90.61699430137196},{latitude:16.48530983132722,longitude:-90.59379504132109},{latitude:16.47197195636916,longitude:-90.58755505092498},{latitude:16.47654527164626,longitude:-90.5504222871908},{latitude:16.46025806160274,longitude:-90.53643779467802},{latitude:16.46627040466211,longitude:-90.51169266835039},{latitude:16.4559276218193,longitude:-90.49463397361676},{latitude:16.44944519404615,longitude:-90.47912640338123},{latitude:16.42875731377697,longitude:-90.4873519095992},{latitude:16.42162796319907,longitude:-90.47987292134036},{latitude:16.42170785101907,longitude:-90.45252739305899},{latitude:16.422587516022,longitude:-90.4193922946199},{latitude:16.40512635469648,longitude:-90.4085894046284},{latitude:16.41391705333114,longitude:-90.38955003305321},{latitude:16.40119290674085,longitude:-90.39201469335235},{latitude:16.39480413401071,longitude:-90.40442910547782},{latitude:16.37499430531166,longitude:-90.38282824558274},{latitude:16.3662819844855,longitude:-90.371194427715},{latitude:16.36149792530785,longitude:-90.37781632590558},{latitude:16.36861865761735,longitude:-90.39027393162584},{latitude:16.3701801809805,longitude:-90.40105663740035},{latitude:16.36061418647934,longitude:-90.41346427337457},{latitude:16.34949787659739,longitude:-90.41094629280633},{latitude:16.35667121719096,longitude:-90.40184815614619},{latitude:16.34873597975026,longitude:-90.39768117282155},{latitude:16.33844091110167,longitude:-90.38272170954531},{latitude:16.33365741179273,longitude:-90.3893378093548},{latitude:16.3312407691548,longitude:-90.40342265819194},{latitude:16.32565872318744,longitude:-90.41169183845358},{latitude:16.3073830072502,longitude:-90.40996919442182},{latitude:16.30577314214456,longitude:-90.41908059997121},{latitude:16.29858272654058,longitude:-90.43562881562531},{latitude:16.28983604880709,longitude:-90.43725502265492},{latitude:16.27870393476207,longitude:-90.43887277095624},{latitude:16.26125532490457,longitude:-90.423084151315},{latitude:16.25408093013824,longitude:-90.43134108649474},{latitude:16.25881283295327,longitude:-90.44625861483246},{latitude:16.25164197923958,longitude:-90.45451976239183},{latitude:16.2405208057578,longitude:-90.45200153111954},{latitude:16.24054977934872,longitude:-90.43875096484253},{latitude:16.23183458257217,longitude:-90.42879488244694},{latitude:16.22864194942793,longitude:-90.43375114124721},{latitude:16.22543147958175,longitude:-90.4469883264089},{latitude:16.21190198575489,longitude:-90.45605717117034},{latitude:16.18727172996184,longitude:-90.45267230432434},{latitude:16.17697167686987,longitude:-90.43691261419171},{latitude:16.16825255995082,longitude:-90.42446879835811},{latitude:16.16029397222886,longitude:-90.42692600610248},{latitude:16.15469356928103,longitude:-90.44263519168283},{latitude:16.14990732972431,longitude:-90.45089857433517},{latitude:16.14354866754336,longitude:-90.44839386438669},{latitude:16.14038935117628,longitude:-90.43596552377311},{latitude:16.13244892451481,longitude:-90.42931788408822},{latitude:16.11812752077931,longitude:-90.43009862761464},{latitude:16.12049343123408,longitude:-90.44003858079861},{latitude:16.11808359286265,longitude:-90.45493236258042},{latitude:16.10614797082921,longitude:-90.4565483666548},{latitude:16.09421153192349,longitude:-90.4581642882261},{latitude:16.09422724066256,longitude:-90.44740290734856},{latitude:16.10379947553103,longitude:-90.43336224676934},{latitude:16.09904083164488,longitude:-90.42589770049423},{latitude:16.09505385680168,longitude:-90.43002294905985},{latitude:16.09185209068656,longitude:-90.43911641707447},{latitude:16.07982775312019,longitude:-90.44802495022171},{latitude:16.07029937123855,longitude:-90.44134942791699},{latitude:16.07268735756528,longitude:-90.70144968483895},{latitude:16.07369738005952,longitude:-91.73113178839499},{latitude:15.26085416575483,longitude:-92.21086575608318},{latitude:15.0685912504457,longitude:-92.05922421742693},{latitude:15.05965204989583,longitude:-92.07536224706021},{latitude:15.05027791071533,longitude:-92.06875005203632},{latitude:15.04458916893507,longitude:-92.07764272647498},{latitude:15.02951628175219,longitude:-92.07911257868285},{latitude:15.0213596244393,longitude:-92.09372800739371},{latitude:15.01090804878067,longitude:-92.1026218895974},{latitude:15.01059191165486,longitude:-92.12391077198657},{latitude:15.00565723635029,longitude:-92.13697414258293},{latitude:14.98950338665307,longitude:-92.14837482218889},{latitude:14.98065274798082,longitude:-92.15079644955235},{latitude:14.96316525698142,longitude:-92.14572562858666},{latitude:14.94290828505658,longitude:-92.14799751962802},{latitude:14.92309166517456,longitude:-92.14532900364307},{latitude:14.89535957486389,longitude:-92.13928766193692},{latitude:14.87863598916288,longitude:-92.14240190130181},{latitude:14.86256246874538,longitude:-92.15704055270571},{latitude:14.8575895201883,longitude:-92.17426533317941},{latitude:14.83600033165319,longitude:-92.18228326841638},{latitude:14.80261867457291,longitude:-92.17700461939224},{latitude:14.7804248646165,longitude:-92.16690340032743},{latitude:14.76456126178101,longitude:-92.16015679036744},{latitude:14.75488953199485,longitude:-92.16992828016882},{latitude:14.74294491842905,longitude:-92.16897966613767},{latitude:14.73350987244905,longitude:-92.15736006952294},{latitude:14.71607341368036,longitude:-92.14972884307247},{latitude:14.6914706413997,longitude:-92.14370528177247},{latitude:14.67152336569704,longitude:-92.14842248783695},{latitude:14.65559137540167,longitude:-92.14989127699376},{latitude:14.64272419806071,longitude:-92.16208573781816},{latitude:14.62347817708671,longitude:-92.17503216992391},{latitude:14.61544560411971,longitude:-92.18152305465642},{latitude:14.58438931824262,longitude:-92.18118377986619},{latitude:14.56193516908235,longitude:-92.1941012439143},{latitude:14.55697514646466,longitude:-92.20967846223954},{latitude:14.53440362453677,longitude:-92.23083253063267},{latitude:14.47593022636225,longitude:-92.15003351085218},{latitude:14.43745122632675,longitude:-92.09858354850371},{latitude:14.36520972354285,longitude:-92.00327446317191},{latitude:14.30543394610958,longitude:-91.93366736529744},{latitude:14.26853012503194,longitude:-91.88157266336403},{latitude:14.21345256551082,longitude:-91.81123992293394},{latitude:14.18815996154174,longitude:-91.78964070536074},{latitude:14.16859829366184,longitude:-91.74756274099579},{latitude:14.05046761854816,longitude:-91.56211032878466},{latitude:14.00911537509416,longitude:-91.4600649133447},{latitude:13.95672941619528,longitude:-91.33419987450493},{latitude:13.91125537266815,longitude:-91.10928615064391},{latitude:13.90920613111373,longitude:-90.92070370167257},{latitude:13.9111890839979,longitude:-90.84344721751593},{latitude:13.91883457906361,longitude:-90.72915230762457},{latitude:13.91702072746141,longitude:-90.62695387899774},{latitude:13.89266004591205,longitude:-90.52712506725335},{latitude:13.86742457953931,longitude:-90.43529368751396},{latitude:13.84046494984477,longitude:-90.36975527974525},{latitude:13.77943174801085,longitude:-90.21775446544829},{latitude:13.73797740149125,longitude:-90.12742249047831},{latitude:13.74883959755507,longitude:-90.11788570864027},{latitude:13.741885977077,longitude:-90.1106965586234},{latitude:13.74345300941356,longitude:-90.10193391625613},{latitude:13.75476092036738,longitude:-90.09315949956815},{latitude:13.75965495774709,longitude:-90.09990535896277},{latitude:13.7760013252141,longitude:-90.10415550598488},{latitude:13.78089807895253,longitude:-90.1083756497392},{latitude:13.78128826473124,longitude:-90.11679138043347},{latitude:13.78741540198361,longitude:-90.11848938805966},{latitude:13.79723343323173,longitude:-90.11430607799727},{latitude:13.80173514419527,longitude:-90.11137182407913},{latitude:13.80581971523581,longitude:-90.11222314448503},{latitude:13.79069159687109,longitude:-90.1155522361111},{latitude:13.80828430190916,longitude:-90.10633871301189},{latitude:13.82053635212394,longitude:-90.10931341327139},{latitude:13.82788373556028,longitude:-90.11269743373647},{latitude:13.83606505238227,longitude:-90.10809004583447},{latitude:13.84221255822396,longitude:-90.09885028211392},{latitude:13.85406183200769,longitude:-90.09636198819128},{latitude:13.86102046644916,longitude:-90.08671489246281},{latitude:13.87244651453261,longitude:-90.08130941849248},{latitude:13.87855971189059,longitude:-90.07505598838822},{latitude:13.88099639773865,longitude:-90.06587367987807},{latitude:13.88550198035949,longitude:-90.06542667587857},{latitude:13.89078265301088,longitude:-90.05459086946763},{latitude:13.89440883442552,longitude:-90.04254666566006},{latitude:13.89892193345298,longitude:-90.03635893701782},{latitude:13.91568592914383,longitude:-90.03803698063382},{latitude:13.92019630099171,longitude:-90.0313424531831},{latitude:13.92218945731484,longitude:-90.02717233777479},{latitude:13.92624613751124,longitude:-90.03052887525523},{latitude:13.93367361561659,longitude:-90.0256349775819},{latitude:13.94035668285728,longitude:-90.02079779064341},{latitude:13.94576483125637,longitude:-90.00933816116208},{latitude:13.9566241119941,longitude:-89.9936930185018},{latitude:13.96329190149163,longitude:-89.96742906010682},{latitude:13.9742880375665,longitude:-89.96064181567196},{latitude:13.98596818624083,longitude:-89.93674023516178},{latitude:14.00695550614606,longitude:-89.91961350149272},{latitude:14.01711990421861,longitude:-89.9046815726916},{latitude:14.02726944757095,longitude:-89.90544003235041},{latitude:14.03380613818533,longitude:-89.8987178852408},{latitude:14.04325931052364,longitude:-89.88227310845255},{latitude:14.04326424079538,longitude:-89.87034357281245},{latitude:14.0418156242786,longitude:-89.86067966021874},{latitude:14.05559199528617,longitude:-89.85619212350672},{latitude:14.05776035102196,longitude:-89.85024950130176},{latitude:14.05852226545909,longitude:-89.83674138317279},{latitude:14.0629008792402,longitude:-89.82324769392092},{latitude:14.05635503688881,longitude:-89.81066191726302},{latitude:14.04981867567212,longitude:-89.7936973079138},{latitude:14.03969642683479,longitude:-89.78778301439436},{latitude:14.03392163297704,longitude:-89.77882400197838},{latitude:14.03537683798431,longitude:-89.7661657448686},{latitude:14.03393769304892,longitude:-89.75793463747196},{latitude:14.0325052246473,longitude:-89.73846950820943},{latitude:14.03540164824189,longitude:-89.73398175915936},{latitude:14.04624027315382,longitude:-89.74523548209687},{latitude:14.06503319262656,longitude:-89.74603605813427},{latitude:14.08091488284729,longitude:-89.74092539882766},{latitude:14.09390552217217,longitude:-89.73205697528084},{latitude:14.12327527634906,longitude:-89.72366740676374},{latitude:14.14490780437468,longitude:-89.70805497679653},{latitude:14.16380562472885,longitude:-89.68400262621216},{latitude:14.17592776430202,longitude:-89.67057119081416},{latitude:14.1861188792974,longitude:-89.66621851349122},{latitude:14.19583466870519,longitude:-89.65025949400031},{latitude:14.20427207553955,longitude:-89.63059080932689},{latitude:14.20226486845507,longitude:-89.59734893204464},{latitude:14.20603421390003,longitude:-89.5742336054946},{latitude:14.21818596235833,longitude:-89.55120322803209},{latitude:14.21771122282335,longitude:-89.53615770698119},{latitude:14.22522087739156,longitude:-89.52547435873139},{latitude:14.23132513312894,longitude:-89.52207179927974},{latitude:14.24964266870253,longitude:-89.52934046744001},{latitude:14.26795663950329,longitude:-89.54486274767979},{latitude:14.27406364252877,longitude:-89.5516400774294},{latitude:14.27829244443763,longitude:-89.54678334518799},{latitude:14.2876860575873,longitude:-89.54726314737805},{latitude:14.2956682156421,longitude:-89.543871397107},{latitude:14.30224000156883,longitude:-89.55066346786424},{latitude:14.30458563920095,longitude:-89.55648464021552},{latitude:14.31489035704792,longitude:-89.56476420389848},{latitude:14.3148312973111,longitude:-89.57696211918032},{latitude:14.31482944054959,longitude:-89.58229033253058},{latitude:14.3120198785771,longitude:-89.58857728099981},{latitude:14.31388841263334,longitude:-89.59246040339789},{latitude:14.32558174326232,longitude:-89.59249767353495},{latitude:14.34668727010759,longitude:-89.58523329743348},{latitude:14.35048301376178,longitude:-89.57792809521554},{latitude:14.35290256324637,longitude:-89.56428786413703},{latitude:14.36129764392244,longitude:-89.5725763016677},{latitude:14.37292836178065,longitude:-89.57847127079161},{latitude:14.3879787287535,longitude:-89.5803310830912},{latitude:14.41575604170618,longitude:-89.57669780323215},{latitude:14.41709965246029,longitude:-89.56617341750197},{latitude:14.41372128668388,longitude:-89.54166193733308},{latitude:14.40439609308641,longitude:-89.53631876721515},{latitude:14.39305820127055,longitude:-89.53348668495441},{latitude:14.38604439323149,longitude:-89.53444823502218},{latitude:14.38043958513695,longitude:-89.52863826321382},{latitude:14.38652088130891,longitude:-89.51993517031019},{latitude:14.39400081105398,longitude:-89.51993882149182},{latitude:14.39821848428005,longitude:-89.51461609869722},{latitude:14.3972962003937,longitude:-89.51122584966973},{latitude:14.40853000734172,longitude:-89.50783876821922},{latitude:14.40713665235117,longitude:-89.5005822655511},{latitude:14.41789660272855,longitude:-89.49090818069244},{latitude:14.42729291298042,longitude:-89.47350555170145},{latitude:14.42636753048505,longitude:-89.46771327203906},{latitude:14.41990560976892,longitude:-89.4479850161286},{latitude:14.41337923304203,longitude:-89.43787881612487},{latitude:14.417195902794,longitude:-89.42784922577863},{latitude:14.4242896105368,longitude:-89.41597688124509},{latitude:14.43319885196858,longitude:-89.40557739646718},{latitude:14.44762985855284,longitude:-89.39999416403607},{latitude:14.44953892517885,longitude:-89.38784911530074},{latitude:14.43229511430747,longitude:-89.3848230803418},{latitude:14.43624877224195,longitude:-89.38006963189484},{latitude:14.4313074807039,longitude:-89.37235426929375},{latitude:14.42245544325631,longitude:-89.35416449506704},{latitude:14.43052941142524,longitude:-89.3475451076706},{latitude:14.44740026331538,longitude:-89.35241332452965},{latitude:14.46677259092223,longitude:-89.35424150437628},{latitude:14.4891719404925,longitude:-89.31398480941678},{latitude:14.49330185442844,longitude:-89.30297968299172},{latitude:14.50617661517669,longitude:-89.30493445502654},{latitude:14.51454537921303,longitude:-89.28954827870767},{latitude:14.519876834303,longitude:-89.28647058564806},{latitude:14.53185391526919,longitude:-89.28018858506528},{latitude:14.54493243421646,longitude:-89.26848353055242},{latitude:14.54969523433277,longitude:-89.26170883908132},{latitude:14.55801744722062,longitude:-89.25615740597594},{latitude:14.56097991851615,longitude:-89.252473487469},{latitude:14.56690660789214,longitude:-89.25289727880593},{latitude:14.58428022829073,longitude:-89.23822739437544},{latitude:14.58639676494006,longitude:-89.22493513711895},{latitude:14.58138489815537,longitude:-89.20803896675777},{latitude:14.57239966439956,longitude:-89.179984997077},{latitude:14.57123315176254,longitude:-89.16935876963338},{latitude:14.5729224997887,longitude:-89.16340630059347},{latitude:14.57799794823651,longitude:-89.15622293419678},{latitude:14.58466290698877,longitude:-89.153481937311},{latitude:14.59907511512183,longitude:-89.15080729814969},{latitude:14.61693593811656,longitude:-89.15256340477893},{latitude:14.6267511651913,longitude:-89.14587454599938},{latitude:14.65775847914681,longitude:-89.15332635990704},{latitude:14.66843708082943,longitude:-89.15511374554713},{latitude:14.67448845776087,longitude:-89.14920627145196},{latitude:14.71336830404275,longitude:-89.13215887004077},{latitude:14.73176011128144,longitude:-89.16554641194337},{latitude:14.77262196124344,longitude:-89.16788617296427},{latitude:14.82700559290945,longitude:-89.21922467001593},{latitude:14.83867150101083,longitude:-89.22501176904986},{latitude:14.87777107390418,longitude:-89.22789874245883},{latitude:14.88400609956747,longitude:-89.22485479631958},{latitude:14.88879285022316,longitude:-89.21553161056441},{latitude:14.89799886528044,longitude:-89.2036266894127},{latitude:14.89930220679732,longitude:-89.19062897308534},{latitude:14.91111005665688,longitude:-89.18036704152985},{latitude:14.92411534731335,longitude:-89.17602861883511},{latitude:14.93156301913523,longitude:-89.1716754701491},{latitude:14.93763761911283,longitude:-89.17504568260843},{latitude:14.94743815758588,longitude:-89.16486871353293},{latitude:14.96470242537534,longitude:-89.16047742042797},{latitude:14.96937301199791,longitude:-89.16142364517495},{latitude:14.97822001249376,longitude:-89.15804972860842},{latitude:14.98475361856945,longitude:-89.15947203663788},{latitude:14.98522897073657,longitude:-89.16667933173468},{latitude:14.99036618263922,longitude:-89.17342626546484},{latitude:14.99456516918925,longitude:-89.17775436429177},{latitude:14.99876308805652,longitude:-89.18208162078824},{latitude:15.0029622874768,longitude:-89.18497221520408},{latitude:15.012385141451,longitude:-89.17835863875395},{latitude:15.02270081118466,longitude:-89.17449716657784},{latitude:15.02736880014906,longitude:-89.17157565923499},{latitude:15.03297366053378,longitude:-89.17494482450429},{latitude:15.03958958893249,longitude:-89.1730374657172},{latitude:15.04107614813388,longitude:-89.1643483149077},{latitude:15.05395779647197,longitude:-89.15563587919837},{latitude:15.06843237883658,longitude:-89.15169091792726},{latitude:15.1330757038096,longitude:-88.97701849197892},{latitude:15.24069666662571,longitude:-88.85062583266296},{latitude:15.34216442072536,longitude:-88.67871205924986},{latitude:15.41231042593993,longitude:-88.60222925558239},{latitude:15.42159411144304,longitude:-88.58764111631305},{latitude:15.41978089515412,longitude:-88.58263846760382},{latitude:15.42441441494558,longitude:-88.57634299023533},{latitude:15.43016791243066,longitude:-88.56623089503033},{latitude:15.44019434440503,longitude:-88.56290950843678},{latitude:15.44598002624405,longitude:-88.55707239877374},{latitude:15.44775964588279,longitude:-88.54890699954488},{latitude:15.58181799542139,longitude:-88.39059258746211},{latitude:15.61985933755239,longitude:-88.34606406839566},{latitude:15.63685791509063,longitude:-88.33411652997064},{latitude:15.63919064278098,longitude:-88.3271981263281},{latitude:15.6519815018942,longitude:-88.32365561711964},{latitude:15.66195767278424,longitude:-88.32458439635312},{latitude:15.66813515369868,longitude:-88.32553514910704},{latitude:15.67096445065998,longitude:-88.32206619342651},{latitude:15.67046766883964,longitude:-88.31812311058371},{latitude:15.67945776436167,longitude:-88.31264503920335},{latitude:15.68301968236781,longitude:-88.31204423032857},{latitude:15.68067350412159,longitude:-88.3086741365026},{latitude:15.67693790829561,longitude:-88.30652127237089},{latitude:15.67250832954281,longitude:-88.30509785668374},{latitude:15.67548441686976,longitude:-88.29637844327002},{latitude:15.67449586003819,longitude:-88.28623293342346},{latitude:15.67493921350215,longitude:-88.28236346570434},{latitude:15.67794906788248,longitude:-88.27968636594152},{latitude:15.68283845721769,longitude:-88.2801396462027},{latitude:15.68892645835818,longitude:-88.28662745625306},{latitude:15.69334256954822,longitude:-88.28563317798074},{latitude:15.69496195110381,longitude:-88.28393100404414},{latitude:15.69214403514632,longitude:-88.27959790120055},{latitude:15.68513475272074,longitude:-88.27480820513276},{latitude:15.68605055134799,longitude:-88.27214264984077},{latitude:15.69022848845641,longitude:-88.27018178414933},{latitude:15.69301164769544,longitude:-88.26847148505483},{latitude:15.69323120942575,longitude:-88.26605090621342},{latitude:15.68926699533426,longitude:-88.26462345457347},{latitude:15.68416308401237,longitude:-88.26755850631335},{latitude:15.68228889960163,longitude:-88.26539291407549},{latitude:15.68319059191196,longitude:-88.26030881957506},{latitude:15.6855054592734,longitude:-88.25811803299392},{latitude:15.6899276355776,longitude:-88.25809044756213},{latitude:15.69251277770414,longitude:-88.26242715242556},{latitude:15.69553955700528,longitude:-88.26265047071009},{latitude:15.69575283159195,longitude:-88.25926391303597},{latitude:15.6906160539233,longitude:-88.25639356457992},{latitude:15.68664253856702,longitude:-88.25351644600129},{latitude:15.68802499863307,longitude:-88.25108949805436},{latitude:15.68846937702773,longitude:-88.2474592761733},{latitude:15.69148803670151,longitude:-88.24623165965572},{latitude:15.69568587063842,longitude:-88.24765672519912},{latitude:15.69616805771787,longitude:-88.25055598344596},{latitude:15.69941672984961,longitude:-88.24884269074391},{latitude:15.69892768372757,longitude:-88.24473385641231},{latitude:15.69914654597695,longitude:-88.24231361281832},{latitude:15.70100716926514,longitude:-88.24206007089894},{latitude:15.70358403739325,longitude:-88.24494650742051},{latitude:15.70706834556371,longitude:-88.24371517503613},{latitude:15.70915199914814,longitude:-88.24176705760212},{latitude:15.71194911339744,longitude:-88.24247506408325},{latitude:15.71173004319717,longitude:-88.24489540761451},{latitude:15.71174095449604,longitude:-88.24683045420242},{latitude:15.71430099924178,longitude:-88.24681448642238},{latitude:15.71757406009485,longitude:-88.24945480793396},{latitude:15.72061134592953,longitude:-88.25136959710881},{latitude:15.7222470007483,longitude:-88.25232561154469},{latitude:15.72503848738091,longitude:-88.25182297629887},{latitude:15.72502707795775,longitude:-88.24988859607565},{latitude:15.72266700781101,longitude:-88.24458522779661},{latitude:15.72310052994405,longitude:-88.23853231320899},{latitude:15.72446252562269,longitude:-88.23174434741807},{latitude:15.72419735447549,longitude:-88.22569379861879},{latitude:15.74260575476194,longitude:-88.25066254740121},{latitude:15.77945812305735,longitude:-88.30183734174318},{latitude:15.83106725731163,longitude:-88.38900533426121},{latitude:15.89630775246283,longitude:-88.48169660406914},{latitude:15.96418732620815,longitude:-88.56581489355446},{latitude:15.9763125037493,longitude:-88.63028018681281},{latitude:15.94166193348074,longitude:-88.63423404775574},{latitude:15.89499237976807,longitude:-88.59746030139787},{latitude:15.87119471431465,longitude:-88.57765720934044},{latitude:15.8247071515617,longitude:-88.58356684835731},{latitude:15.77919728292889,longitude:-88.60463094621657},{latitude:15.78665765068514,longitude:-88.64345807607104},{latitude:15.83894432792621,longitude:-88.72190710949977},{latitude:15.89310571002559,longitude:-88.82315736537971},{latitude:15.90335909340615,longitude:-88.89143103673496},{latitude:15.90136665327453,longitude:-88.91098527722444},{latitude:15.89435881071358,longitude:-88.91737532277107},{latitude:15.88782212453268,longitude:-88.92522477427636},{latitude:15.89025629210362,longitude:-88.94742460459993},{latitude:15.88934494919911,longitude:-88.95810650965703},{latitude:15.89402869634867,longitude:-88.96682340797005},{latitude:15.89591425135534,longitude:-88.97895046312583},{latitude:15.8987272259915,longitude:-88.98718789982311},{latitude:15.90342304355638,longitude:-88.99783410502171},{latitude:15.89970330704444,longitude:-89.00414901513744},{latitude:15.89647570720701,longitude:-89.02015406167051},{latitude:15.8983524274679,longitude:-89.02354119991904},{latitude:15.90721733988119,longitude:-89.01963627832276},{latitude:15.91189829320457,longitude:-89.02544235295687},{latitude:15.91192483498303,longitude:-89.03659544192014},{latitude:15.91333422372455,longitude:-89.04144127586152},{latitude:15.90588304660975,longitude:-89.0467931283174},{latitude:15.9026307580254,longitude:-89.05261941630914},{latitude:15.91569580143634,longitude:-89.05598298880618},{latitude:15.91104136240246,longitude:-89.06084248558736},{latitude:15.90358577906335,longitude:-89.06376879143625},{latitude:15.90172731373457,longitude:-89.067166940318},{latitude:15.90780231378506,longitude:-89.07394057674675},{latitude:15.90641122334058,longitude:-89.07782247810653},{latitude:15.898484393402,longitude:-89.07784040754873},{latitude:15.8998946391411,longitude:-89.08268672774813},{latitude:15.90924473695431,longitude:-89.09285108656722},{latitude:15.91206241969693,longitude:-89.10109136641029},{latitude:15.91021441653878,longitude:-89.10885646433431},{latitude:15.90696582052081,longitude:-89.11613965855931},{latitude:15.90510629971015,longitude:-89.11905377969879},{latitude:15.90089770495667,longitude:-89.11372676699125},{latitude:15.89717234992591,longitude:-89.11761143799038},{latitude:15.90278083260766,longitude:-89.12342065852778},{latitude:15.89952618385189,longitude:-89.13021210729332},{latitude:15.90560338743656,longitude:-89.1345741445532},{latitude:15.90094331314221,longitude:-89.13845784140941},{latitude:15.89862604241779,longitude:-89.14670592647609},{latitude:15.89863940540255,longitude:-89.15349784679168},{latitude:15.90379595766942,longitude:-89.16465659263925},{latitude:15.91221585712367,longitude:-89.17677462000741},{latitude:15.90943100769583,longitude:-89.18454338330345},{latitude:15.90570525602423,longitude:-89.18939658317751},{latitude:15.90056741894536,longitude:-89.18793913814351},{latitude:15.89964242337205,longitude:-89.19327433009211},{latitude:15.90198586478652,longitude:-89.19909650582545},{latitude:15.89733011174401,longitude:-89.20395810597559},{latitude:15.89732062194306,longitude:-89.21261959420549},{latitude:15.8947308224349,longitude:-89.21550143447524},{latitude:15.8894882591085,longitude:-89.21631195223546},{latitude:15.88670411913424,longitude:-89.21921556429014},{latitude:15.88670712936854,longitude:-89.22291676300817},{latitude:15.88748092466889,longitude:-89.22596511359456},{latitude:15.89460533087204,longitude:-89.22515763509732},{latitude:15.89630857222379,longitude:-89.22756717513691},{latitude:16.02170092533115,longitude:-89.21899490439978},{latitude:16.25872386227848,longitude:-89.20311369584829},{latitude:16.53618873242919,longitude:-89.18455617421182},{latitude:16.67728263891706,longitude:-89.17519936135288},{latitude:16.99321326081799,longitude:-89.15457518516965},{latitude:17.05434968634109,longitude:-89.14913339296686},{latitude:17.1677889036325,longitude:-89.14962292767392},{latitude:17.30162427925703,longitude:-89.15008935003699},{latitude:17.49092154821819,longitude:-89.1504229867636},{latitude:17.68841402139864,longitude:-89.15112160543588},{latitude:17.79601647652631,longitude:-89.15159371793499},{latitude:17.81585431079451,longitude:-89.15260567494511}];



// MySQL Scape String, requires MySQL conn object declared
function sj(s){
  return conn.escape(s);
};


// convert a twitter timestamp to the standard date-time timestamp mysql handles
Date.prototype.toMysqlFormat = function(){
  var twoDigits = function(d) {
      if(0 <= d && d < 10) return "0" + d.toString();
      if(-10 < d && d < 0) return "-0" + (-1*d).toString();
      return d.toString();
  }
    return this.getUTCFullYear() + "-" + twoDigits(1 + this.getUTCMonth()) + "-" + twoDigits(this.getUTCDate()) + " " + twoDigits(this.getUTCHours()) + ":" + twoDigits(this.getUTCMinutes()) + ":" + twoDigits(this.getUTCSeconds());
};
// Date from Twitter to MySQL
twit_date = function(td){
  return new Date(td).toMysqlFormat();
}
// Return the elapsed days from today date from a twitter time stamp
function elapsedDays(time_stamp){
  var ts = new Date(time_stamp);
  var today = new Date();
  var one_day = 1000*60*60*24;
  return Math.ceil((today.getTime() - ts.getTime())/(one_day));
}
// returns current UTC Unix time in seconds
nowUnix = function(){
    var now = new Date();
    return parseInt(now.getTime()/1000)
}

// to add/substract hours to a time and return MySQL time format
timeOffst = function(t,h){
  t = parseInt(t);
  r = new Date((t+(h*60*60))*1000);
  return r.toMysqlFormat();
}

// extract the first url, for twitter client source
find1stURL = function( text ){
  text=''+text;
    var source = (text || '').toString();
    var urlArray = [];
    var url;
    var matchArray;
    var regexToken = /(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)|((mailto:)?[_.\w-]+@([\w][\w\-]+\.)+[a-zA-Z]{2,3})/g;
    while( (matchArray = regexToken.exec( source )) !== null ){
        var token = matchArray[0];
        urlArray.push( token );
    }
    return urlArray[0];
}

// remove HTML from strings
strip_html = function(s){
    var noHTML = /(<([^>]+)>)/ig;
    return s.replace(noHTML, '');
}
// html translation table, required by html_entity_decode
get_html_translation_table = function (table, quote_style) {
    // http://kevin.vanzonneveld.net
    // +   original by: Philip Peterson
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: noname
    // +   bugfixed by: Alex
    // +   bugfixed by: Marco
    // +   bugfixed by: madipta
    // +   improved by: KELAN
    // +   improved by: Brett Zamir (http://brett-zamir.me)
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Frank Forte
    // +   bugfixed by: T.Wild
    // +      input by: Ratheous
    // %          note: It has been decided that we're not going to add global
    // %          note: dependencies to php.js, meaning the constants are not
    // %          note: real constants, but strings instead. Integers are also supported if someone
    // %          note: chooses to create the constants themselves.
    // *     example 1: get_html_translation_table('HTML_SPECIALCHARS');
    // *     returns 1: {'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}
    var entities = {},
        hash_map = {},
        decimal;
    var constMappingTable = {},
        constMappingQuoteStyle = {};
    var useTable = {},
        useQuoteStyle = {};

    // Translate arguments
    constMappingTable[0] = 'HTML_SPECIALCHARS';
    constMappingTable[1] = 'HTML_ENTITIES';
    constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
    constMappingQuoteStyle[2] = 'ENT_COMPAT';
    constMappingQuoteStyle[3] = 'ENT_QUOTES';

    useTable = !isNaN(table) ? constMappingTable[table] : table ? table.toUpperCase() : 'HTML_SPECIALCHARS';
    useQuoteStyle = !isNaN(quote_style) ? constMappingQuoteStyle[quote_style] : quote_style ? quote_style.toUpperCase() : 'ENT_COMPAT';

    if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
        throw new Error("Table: " + useTable + ' not supported');
        // return false;
    }

    entities['38'] = '&amp;';
    if (useTable === 'HTML_ENTITIES') {
        entities['160'] = '&nbsp;';
        entities['161'] = '&iexcl;';
        entities['162'] = '&cent;';
        entities['163'] = '&pound;';
        entities['164'] = '&curren;';
        entities['165'] = '&yen;';
        entities['166'] = '&brvbar;';
        entities['167'] = '&sect;';
        entities['168'] = '&uml;';
        entities['169'] = '&copy;';
        entities['170'] = '&ordf;';
        entities['171'] = '&laquo;';
        entities['172'] = '&not;';
        entities['173'] = '&shy;';
        entities['174'] = '&reg;';
        entities['175'] = '&macr;';
        entities['176'] = '&deg;';
        entities['177'] = '&plusmn;';
        entities['178'] = '&sup2;';
        entities['179'] = '&sup3;';
        entities['180'] = '&acute;';
        entities['181'] = '&micro;';
        entities['182'] = '&para;';
        entities['183'] = '&middot;';
        entities['184'] = '&cedil;';
        entities['185'] = '&sup1;';
        entities['186'] = '&ordm;';
        entities['187'] = '&raquo;';
        entities['188'] = '&frac14;';
        entities['189'] = '&frac12;';
        entities['190'] = '&frac34;';
        entities['191'] = '&iquest;';
        entities['192'] = '&Agrave;';
        entities['193'] = '&Aacute;';
        entities['194'] = '&Acirc;';
        entities['195'] = '&Atilde;';
        entities['196'] = '&Auml;';
        entities['197'] = '&Aring;';
        entities['198'] = '&AElig;';
        entities['199'] = '&Ccedil;';
        entities['200'] = '&Egrave;';
        entities['201'] = '&Eacute;';
        entities['202'] = '&Ecirc;';
        entities['203'] = '&Euml;';
        entities['204'] = '&Igrave;';
        entities['205'] = '&Iacute;';
        entities['206'] = '&Icirc;';
        entities['207'] = '&Iuml;';
        entities['208'] = '&ETH;';
        entities['209'] = '&Ntilde;';
        entities['210'] = '&Ograve;';
        entities['211'] = '&Oacute;';
        entities['212'] = '&Ocirc;';
        entities['213'] = '&Otilde;';
        entities['214'] = '&Ouml;';
        entities['215'] = '&times;';
        entities['216'] = '&Oslash;';
        entities['217'] = '&Ugrave;';
        entities['218'] = '&Uacute;';
        entities['219'] = '&Ucirc;';
        entities['220'] = '&Uuml;';
        entities['221'] = '&Yacute;';
        entities['222'] = '&THORN;';
        entities['223'] = '&szlig;';
        entities['224'] = '&agrave;';
        entities['225'] = '&aacute;';
        entities['226'] = '&acirc;';
        entities['227'] = '&atilde;';
        entities['228'] = '&auml;';
        entities['229'] = '&aring;';
        entities['230'] = '&aelig;';
        entities['231'] = '&ccedil;';
        entities['232'] = '&egrave;';
        entities['233'] = '&eacute;';
        entities['234'] = '&ecirc;';
        entities['235'] = '&euml;';
        entities['236'] = '&igrave;';
        entities['237'] = '&iacute;';
        entities['238'] = '&icirc;';
        entities['239'] = '&iuml;';
        entities['240'] = '&eth;';
        entities['241'] = '&ntilde;';
        entities['242'] = '&ograve;';
        entities['243'] = '&oacute;';
        entities['244'] = '&ocirc;';
        entities['245'] = '&otilde;';
        entities['246'] = '&ouml;';
        entities['247'] = '&divide;';
        entities['248'] = '&oslash;';
        entities['249'] = '&ugrave;';
        entities['250'] = '&uacute;';
        entities['251'] = '&ucirc;';
        entities['252'] = '&uuml;';
        entities['253'] = '&yacute;';
        entities['254'] = '&thorn;';
        entities['255'] = '&yuml;';
    }

    if (useQuoteStyle !== 'ENT_NOQUOTES') {
        entities['34'] = '&quot;';
    }
    if (useQuoteStyle === 'ENT_QUOTES') {
        entities['39'] = '&#39;';
    }
    entities['60'] = '&lt;';
    entities['62'] = '&gt;';


    // ascii decimals to real symbols
    for (decimal in entities) {
        if (entities.hasOwnProperty(decimal)) {
            hash_map[String.fromCharCode(decimal)] = entities[decimal];
        }
    }

    return hash_map;
}
// html decode entities, required by tweetPlain
html_entity_decode = function (string, quote_style) {
    // http://kevin.vanzonneveld.net
    // +   original by: john (http://www.jd-tech.net)
    // +      input by: ger
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Onno Marsman
    // +   improved by: marc andreu
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +      input by: Ratheous
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Nick Kolosov (http://sammy.ru)
    // +   bugfixed by: Fox
    // -    depends on: get_html_translation_table
    // *     example 1: html_entity_decode('Kevin &amp; van Zonneveld');
    // *     returns 1: 'Kevin & van Zonneveld'
    // *     example 2: html_entity_decode('&amp;lt;');
    // *     returns 2: '&lt;'
    var hash_map = {},
        symbol = '',
        tmp_str = '',
        entity = '';
    tmp_str = string.toString();

    if (false === (hash_map = get_html_translation_table('HTML_ENTITIES', quote_style))) {
        return false;
    }

    // fix &amp; problem
    // http://phpjs.org/functions/get_html_translation_table:416#comment_97660
    delete(hash_map['&']);
    hash_map['&'] = '&amp;';

    for (symbol in hash_map) {
        entity = hash_map[symbol];
        tmp_str = tmp_str.split(entity).join(symbol);
    }
    tmp_str = tmp_str.split('&#039;').join("'");

    return tmp_str;
}
// parse a tweet text with entities and return the original text
tweetPlain = function (body, entities) {
  urls = entities.urls;

  urls.forEach(function (val, index, array) {
    if (val.display_url) {
      link = val.expanded_url;
    }else{
      link = val.url;
    }
    body = body.replace(val.url, link);
  });
  return html_entity_decode(body);
}

// convert seconds to a time format understandable
Number.prototype.toHHMMSS = function () {
    sec_numb    = parseInt(this);
    var hours   = Math.floor(sec_numb / 3600);
    var minutes = Math.floor((sec_numb - (hours * 3600)) / 60);
    var seconds = sec_numb - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
}

// extract mentions and hashtags
function cloudtagExtractor(s){
  var phr = {};
  var words = s.match(/[@#]\w+/g);
  if(words){
    words.forEach(function (val, index, array) {
        phr[val]=0;
    });
    words.forEach(function (val, index, array) {
        phr[val]=phr[val]+1;
    });
  }
  return phr;
}

function JSON_stringify(s, emit_unicode)
{
   var json = JSON.stringify(s);
   return emit_unicode ? json : json.replace(/[\u007f-\uffff]/g,
      function(c) { 
        return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
      }
   );
}