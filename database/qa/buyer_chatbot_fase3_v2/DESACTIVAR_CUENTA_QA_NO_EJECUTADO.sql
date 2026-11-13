-- NO EJECUTADO. Solo al terminar Daniel la aceptación manual.
-- Cambiar a 1 es el opt-in explícito; no modificar IDs ni guardas.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @AUTORIZO_DESACTIVAR_CUENTA_SINTETICA bit=0;
IF @AUTORIZO_DESACTIVAR_CUENTA_SINTETICA<>1
    THROW 51220, 'Se requiere opt-in explícito para desactivar la cuenta sintética.', 1;
IF CAST(@@SERVERNAME AS nvarchar(128))<>N'DANIELPC' OR DB_NAME()<>N'NexoSalud_LeadEnsayoFinal'
    THROW 51221, 'Destino QA incorrecto.', 1;
BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @lock int;
    EXEC @lock=sys.sp_getapplock @Resource='QA_BUYER_CHAT_STAFF_ENSAYOFINAL',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
    IF @lock<0 THROW 51222, 'No se obtuvo el bloqueo de la cuenta QA.', 1;
    IF NOT EXISTS(SELECT 1 FROM dbo.Usuarios u WITH(UPDLOCK,HOLDLOCK)
        JOIN dbo.Roles r ON r.id_rol=u.id_rol WHERE u.id_usuario=5
        AND u.nombres='QA_BUYER_CHAT_ENSAYOFINAL' AND u.apellidos='CUENTA_SINTETICA_FASE3'
        AND r.nombre='Administrador')
        THROW 51223, 'La cuenta no coincide con el sujeto QA autorizado.', 1;
    UPDATE dbo.Usuarios SET activo=0 WHERE id_usuario=5
        AND nombres='QA_BUYER_CHAT_ENSAYOFINAL' AND apellidos='CUENTA_SINTETICA_FASE3';
    COMMIT;
    SELECT id_usuario,activo FROM dbo.Usuarios WHERE id_usuario=5;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    THROW;
END CATCH;
