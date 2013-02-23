/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `twitter_accounts` (
  `id` int(20) NOT NULL,
  `screen_name` varchar(50) DEFAULT NULL,
  `name` varchar(50) DEFAULT NULL,
  `oauth_token` varchar(90) DEFAULT NULL,
  `oauth_token_secret` varchar(90) DEFAULT NULL,
  `busy` tinyint(3) unsigned DEFAULT NULL,
  `release` bigint(20) unsigned DEFAULT NULL,
  `rem_fol_ids` int(10) unsigned DEFAULT NULL,
  `rem_usr_lup` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `screen_name` (`screen_name`),
  KEY `busy` (`busy`),
  KEY `release` (`release`),
  KEY `rem_fol_ids` (`rem_fol_ids`),
  KEY `rem_usr_lup` (`rem_usr_lup`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
INSERT INTO `twitter_accounts` VALUES (1,'twitteraccount','name','token','token secret',0,0,0,0),(2,'screen_name_2','name 2','token','secret',0,0,0,0);
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `twitter_cloudtag` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `sid` int(10) unsigned DEFAULT NULL,
  `word` varchar(255) DEFAULT NULL,
  `score` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sid` (`sid`),
  KEY `word` (`word`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `twitter_descript` (
  `tuser_id` bigint(20) unsigned DEFAULT NULL,
  `description` text,
  UNIQUE KEY `tuser_id` (`tuser_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `twitter_followers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `stid` int(10) unsigned DEFAULT NULL,
  `tuser_id` bigint(20) unsigned DEFAULT NULL,
  `protected` tinyint(1) unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `statuses_count` int(11) unsigned DEFAULT NULL,
  `followers_count` int(11) unsigned DEFAULT NULL,
  `friends_count` int(11) unsigned DEFAULT NULL,
  `listed_count` int(11) unsigned DEFAULT NULL,
  `favourites_count` int(11) unsigned DEFAULT NULL,
  `screen_name` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `profile_image_url` varchar(255) DEFAULT NULL,
  `url` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `time_zone` varchar(255) DEFAULT NULL,
  `utc_offset` int(11) DEFAULT NULL,
  `lt_created_at` datetime DEFAULT NULL,
  `lt_id` bigint(20) unsigned DEFAULT NULL,
  `lt_source_text` varchar(100) DEFAULT NULL,
  `lt_source_url` varchar(255) DEFAULT NULL,
  `lt_htmltext` text,
  `user_full_json` text,
  `nlat` float(10,6) DEFAULT NULL,
  `nlng` float(10,6) DEFAULT NULL,
  `ncountry` varchar(255) DEFAULT NULL,
  `inactivo` tinyint(3) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stid` (`stid`),
  KEY `tuser_id` (`tuser_id`),
  KEY `protected` (`protected`),
  KEY `created_at` (`created_at`),
  KEY `statuses_count` (`statuses_count`),
  KEY `followers_count` (`followers_count`),
  KEY `friends_count` (`friends_count`),
  KEY `listed_count` (`listed_count`),
  KEY `favourites_count` (`favourites_count`),
  KEY `screen_name` (`screen_name`),
  KEY `lt_created_at` (`lt_created_at`),
  KEY `lt_id` (`lt_id`),
  KEY `location` (`location`),
  KEY `lt_source_text` (`lt_source_text`),
  KEY `lt_source_url` (`lt_source_url`),
  KEY `utc_offset` (`utc_offset`),
  KEY `time_zone` (`time_zone`),
  KEY `nlat` (`nlat`),
  KEY `nlng` (`nlng`),
  KEY `ncountry` (`ncountry`),
  KEY `inactivo` (`inactivo`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `twitter_thu_taks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `stid` int(10) unsigned NOT NULL,
  `busy` tinyint(5) unsigned DEFAULT '0',
  `done` tinyint(1) unsigned NOT NULL,
  `ids` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `stid` (`stid`),
  KEY `busy` (`busy`),
  KEY `done` (`done`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `twitter_user` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tuser_id` bigint(20) unsigned DEFAULT NULL,
  `screen_name` varchar(255) DEFAULT NULL,
  `start` datetime DEFAULT NULL,
  `stop` datetime DEFAULT NULL,
  `requests` int(11) unsigned DEFAULT NULL,
  `user_full_json` text,
  PRIMARY KEY (`id`),
  KEY `tuser_id` (`tuser_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE PROCEDURE `cloudTagInsert`(
  dstudyId INT,
  dword varchar(255),
  dscore INT
)
BEGIN 
  SET @fresult := 0;
  SET @nada := NULL;
  SELECT 
    @fresult := `id`
  FROM  `twitter_cloudtag` 
  WHERE  `sid` =dstudyId
  AND  `word`LIKE dword
  LIMIT 1
  into @nada;
  IF (@fresult > 0) THEN 
    UPDATE `twitter_cloudtag` SET  `score` = `score`+dscore WHERE `id` =@fresult;
  ELSE
    INSERT INTO  `twitter_cloudtag` (
      `sid` ,
      `word` ,
      `score`
    )
    VALUES (
      dstudyId,
      dword,
      dscore
    );
  END IF; 
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE PROCEDURE `createTasks`(
	IN isTsk INT
)
BEGIN 
	
	CREATE TEMPORARY TABLE `dtaks` (
	`rank` INT UNSIGNED NULL ,
	`cienes` VARCHAR( 2000 ) NULL
	) ENGINE=MEMORY;
	
	SET @rank=0;
	
	INSERT INTO `dtaks`
	SELECT 
		@rank:=@rank+1 AS rank,
		GROUP_CONCAT(tuser_id ORDER BY tuser_id) AS cienes
	FROM 
		`twitter_followers` 
	WHERE 
		`stid` = isTsk 
	GROUP BY (@rank ) DIV 100;
	
	INSERT INTO `twitter_thu_taks`
	SELECT 
		NULL ,
		isTsk ,
		0 ,
		0  ,
		cienes
	FROM 
		`dtaks`;
  	
	drop table `dtaks`;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE PROCEDURE `getFree`(
	IN isTsk INT
)
BEGIN 
  SET @curr_work := 0;
  SET @curr_ids  := NULL;
  SET @nada  := NULL;
  SELECT @curr_work := `id`  FROM `twitter_thu_taks` WHERE `stid` = isTsk AND `busy` = 0 AND `done` = 0 LIMIT 1 INTO @nada;
  SELECT @curr_ids  := `ids` FROM `twitter_thu_taks` WHERE `id` = @curr_work INTO @nada;
  UPDATE `twitter_thu_taks` SET `busy` = 1 WHERE `id` = @curr_work;
  SELECT @curr_work as work_id, @curr_ids as ids;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
