SET NOCOUNT ON;
IF ISNULL(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') <> N'DANIELPC'
 OR DB_NAME() <> N'NexoSalud_LeadEnsayoFinal'
 THROW 54900,'Destino QA incorrecto.',1;
IF EXISTS(SELECT 1 FROM sys.dm_exec_requests WHERE session_id<>@@SPID AND database_id=DB_ID())
 OR EXISTS(SELECT 1 FROM sys.dm_tran_database_transactions d JOIN sys.dm_tran_session_transactions s ON s.transaction_id=d.transaction_id
 WHERE d.database_id=DB_ID() AND s.session_id<>@@SPID)
 THROW 54901,'Existe otra peticion o transaccion en QA. No iniciar respaldo.',1;
DBCC CHECKDB(N'NexoSalud_LeadEnsayoFinal') WITH NO_INFOMSGS,ALL_ERRORMSGS;
DECLARE @directorio nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath'));
IF NULLIF(@directorio,N'') IS NULL THROW 54902,'No se conoce directorio de respaldo.',1;
DECLARE @archivo nvarchar(4000)=@directorio+N'\NexoSalud_LeadEnsayoFinal_QA_BUYER_20261112T191639Z_'+CONVERT(nvarchar(36),NEWID())+N'.bak';
IF EXISTS(SELECT 1 FROM sys.dm_os_file_exists(@archivo) WHERE file_exists=1)
 THROW 54903,'El archivo ya existe. No sobrescribir ni reutilizar.',1;
BACKUP DATABASE [NexoSalud_LeadEnsayoFinal] TO DISK=@archivo
 WITH COPY_ONLY,CHECKSUM,COMPRESSION,NOFORMAT,NOINIT,STATS=10,
 NAME=N'QA Buyer antes de actualizacion estructural 2026-11-12';
RESTORE VERIFYONLY FROM DISK=@archivo WITH CHECKSUM;
SELECT @archivo AS respaldo_nuevo,SYSUTCDATETIME() AS verificado_utc;
SELECT b.backup_set_uuid,b.backup_start_date,b.backup_finish_date,b.type,b.is_copy_only,b.has_backup_checksums,b.is_damaged,
 b.backup_size,b.compressed_backup_size,b.first_lsn,b.last_lsn,b.database_backup_lsn,f.physical_device_name
FROM msdb.dbo.backupset b JOIN msdb.dbo.backupmediafamily f ON f.media_set_id=b.media_set_id
WHERE b.database_name=DB_NAME() AND f.physical_device_name=@archivo;
