SET NOCOUNT ON;
IF ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') <> N'DANIELPC'
 OR DB_NAME() <> N'NexoSalud_LeadEnsayoFinal'
 THROW 54900,'Destino QA incorrecto.',1;
SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor,DB_NAME() base_efectiva,SYSUTCDATETIME() fecha_utc,
 CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) edicion,
 CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000)) directorio_respaldo;
SELECT s.session_id,s.host_name,s.program_name,s.host_process_id,s.status,s.open_transaction_count
FROM sys.dm_exec_sessions s WHERE s.is_user_process=1 AND s.session_id<>@@SPID
AND (s.database_id=DB_ID() OR EXISTS(SELECT 1 FROM sys.dm_exec_requests r WHERE r.session_id=s.session_id AND r.database_id=DB_ID())
 OR EXISTS(SELECT 1 FROM sys.dm_tran_locks l WHERE l.request_session_id=s.session_id AND l.resource_database_id=DB_ID()));
SELECT COUNT(*) otras_transacciones_en_QA FROM sys.dm_tran_database_transactions d
JOIN sys.dm_tran_session_transactions s ON s.transaction_id=d.transaction_id
WHERE d.database_id=DB_ID() AND s.session_id<>@@SPID;
SELECT TOP(5) b.backup_finish_date,b.type,b.is_copy_only,b.has_backup_checksums,b.is_damaged,b.backup_size,
 f.physical_device_name,b.backup_set_uuid,b.first_lsn,b.last_lsn
FROM msdb.dbo.backupset b JOIN msdb.dbo.backupmediafamily f ON f.media_set_id=b.media_set_id
WHERE b.database_name=DB_NAME() ORDER BY b.backup_finish_date DESC;
SELECT name,type_desc,size*8.0/1024 AS tamano_MB FROM sys.database_files;
