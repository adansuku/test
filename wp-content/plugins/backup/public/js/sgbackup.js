SG_ACTIVE_DOWNLOAD_AJAX = '';
SG_DOWNLOAD_PROGRESS_AJAX = '';
SG_CHECK_ACTION_STATUS_REQUEST_FREQUENCY = 2500;

jQuery(document).on('change', '.btn-file :file', function() {
    var input = jQuery(this),
        numFiles = input.get(0).files ? input.get(0).files.length : 1,
        label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
    input.trigger('fileselect', [numFiles, label]);
});

jQuery(document).ready( function() {
    sgBackup.initTablePagination();
    sgBackup.initActiveAction();
    sgBackup.initBackupDeletion();
    sgBackup.toggleMultiDeleteButton();

    jQuery('span[data-toggle=tooltip]').tooltip();

    jQuery('#sg-checkbox-select-all').on('change', function(){
        var checkAll = jQuery('#sg-checkbox-select-all');
        jQuery('tbody input[type="checkbox"]:not(:disabled):visible').prop('checked', checkAll.prop('checked'));
        sgBackup.toggleMultiDeleteButton();
    });

    jQuery('#sg-delete-multi-backups').on('click', function(){
        var backups = jQuery('tbody input[type="checkbox"]:checked');
        var backupNames = [];
        backups.each(function(i){
            backupNames[i] = jQuery(this).val();
        });

        if (backupNames.length) {
            sgBackup.deleteMultiBackups(backupNames);
        }
    });


    jQuery('tbody input[type="checkbox"]').on('change', function(){
        var numberOfBackups = jQuery('tbody input[type="checkbox"]').length;
        var numberOfChoosenBackups = sgBackup.getSelectedBackupsNumber();
        var isCheked = jQuery(this).is(':checked');
        sgBackup.toggleMultiDeleteButton();

        if(!isCheked) {
            jQuery('#sg-checkbox-select-all').prop('checked', false);
        }
        else {
            if (numberOfBackups == numberOfChoosenBackups) {
                jQuery('#sg-checkbox-select-all').prop('checked', true);
            }
        }
    });
});

sgBackup.getSelectedBackupsNumber = function() {
    return jQuery('tbody input[type="checkbox"]:checked').length
}

sgBackup.toggleMultiDeleteButton = function() {
    var numberOfChoosenBackups = sgBackup.getSelectedBackupsNumber();
    var target = jQuery('#sg-delete-multi-backups');

    if (numberOfChoosenBackups > 0) {
        target.show();
    }
    else {
        target.hide();
    }
}

sgBackup.deleteMultiBackups = function(backupNames){
    var ajaxHandler = new sgRequestHandler('deleteBackup', {backupName: backupNames});
    ajaxHandler.callback = function (response) {
        location.reload();
    };
    ajaxHandler.run();
}

//SGManual Backup AJAX callback
sgBackup.manualBackup = function(){
    var error = [];
    //Validation
    jQuery('.alert').remove();
    if(jQuery('input[type=radio][name=backupType]:checked').val() == 2) {
        if(jQuery('.sg-custom-option:checked').length <= 0) {
            error.push('Please choose at least one option.');
        }
        //Check if any file is selected
        if(jQuery('input[type=checkbox][name=backupFiles]:checked').length > 0) {
            if(jQuery('.sg-custom-backup-files input:checkbox:checked').length <= 0) {
                error.push('Please choose at least one directory.');
            }
        }
    }
    //Check if any cloud is selected
    if(jQuery('input[type=checkbox][name=backupCloud]:checked').length > 0) {
        if (jQuery('.sg-custom-backup-cloud input:checkbox:checked').length <= 0) {
            error.push('Please choose at least one cloud.');
        }
    }
    //If any error show it and abort ajax
    if(error.length){
        var sgAlert = sgBackup.alertGenerator(error, 'alert-danger');
        jQuery('#sg-modal .modal-header').prepend(sgAlert);
        return false;
    }

    //Before all disable buttons...
    jQuery('.alert').remove();
    jQuery('.modal-footer .btn-primary').attr('disabled','disabled');
    jQuery('.modal-footer .btn-primary').html('Backing Up...');

    //Reset Status
    var resetStatusHandler = new sgRequestHandler('resetStatus', {});
    resetStatusHandler.callback = function(response, error){
        var manualBackupForm = jQuery('#manualBackup');
        var manualBackupHandler = new sgRequestHandler('manualBackup', manualBackupForm.serialize());
        manualBackupHandler.dataIsObject = false;
        //If error
        if(typeof response.success === 'undefined') {
            var sgAlert = sgBackup.alertGenerator(response, 'alert-danger');
            jQuery('#sg-modal .modal-header').prepend(sgAlert);

            if (response === 0 || response === false || response === '0' || response === 'false') {
                response = "Something went wrong. Please try again.";
            }

            alert(response);
            location.reload();
            return false;
        }
        manualBackupHandler.run();
        sgBackup.checkBackupCreation();
    };
    resetStatusHandler.run();
};

sgBackup.cancelDonwload = function(name) {
    var cancelDonwloadHandler = new sgRequestHandler('cancelDownload', {name: name});
    cancelDonwloadHandler.callback = function(response){
        sgBackup.hideAjaxSpinner();
        location.reload();
    }
    cancelDonwloadHandler.run();
}

sgBackup.listStorage = function(importFrom){
    var listStorage = new sgRequestHandler('listStorage', {storage: importFrom});
    sgBackup.showAjaxSpinner('#sg-modal-inport-from');
    jQuery('#sg-archive-list-table tbody').empty();

    jQuery('#sg-modal').off('hide.bs.modal').on('hide.bs.modal', function(e){

        if (SG_ACTIVE_DOWNLOAD_AJAX) {
            if (!confirm('Are you sure you want to cancel import?')) {
                e.preventDefault();
                return false;
            }
            var target = jQuery('input[name="select-archive-to-download"]:checked');
            var name = target.attr('file-name');

            sgBackup.cancelDonwload(name);
        }
    });

    listStorage.callback = function(response, error) {
        sgBackup.hideAjaxSpinner();
        listOfFiles = response;
        var content = '';
        if (!listOfFiles) {
            content = '<tr><td colspan="4">No backups found.</td></tr>';
        }
        else {
            jQuery.each(listOfFiles, function( key, value ) {
                content += '<tr>';
                    content += '<td class="file-select-radio"><input type="radio" file-name="'+value.name+'" name="select-archive-to-download" size="'+value.size+'" storage="'+importFrom+'" value="'+value.path+'"></td>';
                    content += '<td>'+value.name+'</td>';
                    content += '<td>'+sgBackup.convertBytesToMegabytes(value.size)+'</td>';
                    content += '<td>'+value.date+'</td>';
                content += '</tr>';
            });
        }

        jQuery('#sg-archive-list-table tbody').append(content);
        sgBackup.toggleDownloadFromCloudPage();
    }

    listStorage.run();
}


sgBackup.convertBytesToMegabytes = function ($bytes) {
    return ($bytes/(1024*1024)).toFixed(2);
}

//Init file upload
sgBackup.initFileUpload = function(){
    sgBackup.downloadFromPC();

    jQuery('#uploadSgbpFile').click(function(){
        if(jQuery('#modal-import-3').is(":visible")) {
            var target = jQuery('input[name="select-archive-to-download"]:checked');
            var path = target.val();
            var name = target.attr('file-name');
            var storage = target.attr('storage');
            var size = target.attr('size');
            sgBackup.downloadFromCloud(path, name, storage, size);
        }
    });
};

sgBackup.nextPage = function(){
    var importFrom = jQuery('input[name="storage-radio"]:checked').val();
    jQuery('.alert').remove();

    if (!importFrom) {
        var alert = sgBackup.alertGenerator('Please select one off the options', 'alert-danger');
        jQuery('#sg-modal .modal-header').prepend(alert);
    }
    else {
        if (importFrom == 'local-pc') {
            sgBackup.toggleDownloadFromPCPage();
        }
        else {
            var isFeatureAvailable = new sgRequestHandler('isFeatureAvailable', {sgFeature: "DOWNLOAD_FROM_CLOUD"});
            isFeatureAvailable.callback = function(response) {
                if (typeof response.success !== 'undefined') {
                    sgBackup.listStorage(importFrom);
                }
                else {
                    var alert = sgBackup.alertGenerator(response.error, 'alert-danger');
                    jQuery('#sg-modal .modal-header').prepend(alert);
                }
            }

            isFeatureAvailable.run();
        }
    }
}

sgBackup.previousPage = function(){
    if(jQuery('#modal-import-2').is(":visible")){
        jQuery('#modal-import-2').hide();
    }
    else{
        jQuery('#modal-import-3').hide();
    }

    sgBackup.toggleNavigationButtons();

    jQuery('#modal-import-1').show();
    jQuery('#uploadSgbpFile').hide();
}

sgBackup.toggleNavigationButtons = function(){
    jQuery('#switch-modal-import-pages-next').toggle();
    jQuery('#switch-modal-import-pages-back').toggle();
}

sgBackup.toggleDownloadFromPCPage = function(){
    sgBackup.toggleNavigationButtons();
    jQuery('#modal-import-1').toggle();
    jQuery('#modal-import-2').toggle();
    jQuery('#uploadSgbpFile').toggle();
}

sgBackup.toggleDownloadFromCloudPage = function(){
    sgBackup.toggleNavigationButtons();
    jQuery('#modal-import-1').toggle();
    jQuery('#modal-import-3').toggle();
    jQuery('#uploadSgbpFile').toggle();
}

sgBackup.downloadFromCloud = function (path, name, storage, size) {
    sgBackup.showAjaxSpinner('.modal-dialog');
    var error = [];
    if (!path) {
        error.push('Please choose one of the files.');
    }

    jQuery('.alert').remove();

    if(error.length){
        sgBackup.hideAjaxSpinner();
        var sgAlert = sgBackup.alertGenerator(error, 'alert-danger');
        jQuery('#sg-modal .modal-header').prepend(sgAlert);
        return false;
    }

    var downloadFromCloudHandler = new sgRequestHandler('downloadFromCloud', {path: path, storage: storage, size: size});
    jQuery('#uploadSgbpFile').attr('disabled','disabled');
    jQuery('#switch-modal-import-pages-back').hide();

    downloadFromCloudHandler.callback = function (response, error){
        sgBackup.hideAjaxSpinner();
        jQuery('.alert').remove();

        SG_DOWNLOAD_PROGRESS_AJAX.abort();

        if (typeof response.success !== 'undefined') {
            location.reload();
        }
        else {
            jQuery('#uploadSgbpFile').html('Import');
            var sgAlert = sgBackup.alertGenerator('Could not download file', 'alert-danger');
            jQuery('#uploadSgbpFile').attr('disabled', false);
            jQuery('#switch-modal-import-pages-back').toggle();
            jQuery('#sg-modal .modal-header').prepend(sgAlert);
        }
    }

    SG_ACTIVE_DOWNLOAD_AJAX = downloadFromCloudHandler.run();
    sgBackup.fileDownloadProgress(name, size);
}

sgBackup.downloadFromPC =  function(){
    var sgData = null;
    jQuery('#sg-modal').off('hide.bs.modal').on('hide.bs.modal', function(e){
        if (SG_ACTIVE_DOWNLOAD_AJAX) {
            if (!confirm('Are you sure you want to cancel import?')) {
                e.preventDefault();
                return false;
            }

            sgData.abort();
            sgBackup.cancelDonwload(sgData.files[0].name);
        }
    });

    jQuery('.sg-backup-upload-input').fileupload({
        dataType: 'json',
        maxChunkSize: 2000000,
        add: function (e, data) {
            jQuery('#uploadSgbpFile').click(function(){
                if(jQuery('#modal-import-2').is(":visible")) {
                    sgData = data;
                    SG_ACTIVE_DOWNLOAD_AJAX = true;
                    jQuery('#uploadSgbpFile').attr('disabled','disabled');
                    jQuery('#switch-modal-import-pages-back').hide();
                    jQuery('#uploadSgbpFile').html('Importing please wait...');
                    data.submit();
                }
            });
        },
        done: function (e, data) {
            location.reload();
        },
        progress: function (e, data) {
            var progress = parseInt(data.loaded / data.total * 100, 10);
            jQuery('#uploadSgbpFile').html('Importing ('+ Math.round(progress)+'%)');
        }
    }).on('fileuploadfail', function (e, data) {
        var alert = sgBackup.alertGenerator('File upload failed.', 'alert-danger');
        jQuery('#sg-modal .modal-header').prepend(alert);
    });
}

sgBackup.fileDownloadProgress = function(file, size){
    var getFileDownloadProgress = new sgRequestHandler('getFileDownloadProgress', {file: file, size: size});

    getFileDownloadProgress.callback = function(response){
        if (typeof response.progress !== 'undefined') {
            jQuery('#uploadSgbpFile').html('Importing ('+ Math.round(response.progress)+'%)');
            setTimeout(function () {
                getFileDownloadProgress.run();
            }, SG_AJAX_REQUEST_FREQUENCY);
        }
    }

    SG_DOWNLOAD_PROGRESS_AJAX = getFileDownloadProgress.run();
}

sgBackup.fileUploadProgress = function(e){
    if(e.lengthComputable){
        jQuery('#uploadSgbpFile').html('Importing ('+ Math.round((e.loaded*100.0)/ e.total)+'%)');
    }
}

sgBackup.checkBackupCreation = function(){
    var sgBackupCreationHandler = new sgRequestHandler('checkBackupCreation', {});
    sgBackupCreationHandler.dataType = 'html';
    sgBackupCreationHandler.callback = function(response){
        jQuery('#sg-modal').modal('hide');
        location.reload();
    };
    sgBackupCreationHandler.run();
};

sgBackup.checkRestoreCreation = function(){
    var sgRestoreCreationHandler = new sgRequestHandler('checkRestoreCreation', {});
    sgRestoreCreationHandler.callback = function(response){
        if (response.status==0 && response.external_enabled==1) {
            location.href = response.external_url;
        }
        else {
            location.reload();
        }
    };
    sgRestoreCreationHandler.run();
};

sgBackup.initManulBackupRadioInputs = function(){
    jQuery('input[type=radio][name=backupType]').off('change').on('change', function(){
        jQuery('.sg-custom-backup').fadeToggle();
    });
	jQuery('input[type=radio][name=restoreType]').off('change').on('change', function(){
		if(jQuery('input[type=radio][name=restoreType]:checked').val() == "files"){
		    jQuery('.sg-restore-files-options').fadeIn();
        }else{
			jQuery('.sg-restore-files-options').fadeOut();
        }
	});

	jQuery('input[type=radio][name=restoreFilesType]').off('change').on('change', function(){
		jQuery('.sg-file-selective-restore').fadeToggle();
	});

    jQuery('input[type=checkbox][name=backupFiles], input[type=checkbox][name=backupDatabase], input[type=checkbox][name=backupCloud]').off('change').on('change', function(){
        var sgCheckBoxWrapper = jQuery(this).closest('.checkbox').find('.sg-checkbox');
        sgCheckBoxWrapper.fadeToggle();
        if(jQuery(this).attr('name') == 'backupFiles') {
            sgCheckBoxWrapper.find('input[type=checkbox]').attr('checked', 'checked');
        }
    });
    jQuery('input[type=radio][name=backupDBType]').off('change').on('change',function(){
		var sgCheckBoxWrapper = jQuery(this).closest('.checkbox').find('.sg-custom-backup-tables');
		if(jQuery('input[type=radio][name=backupDBType]:checked').val() == '2'){
			sgCheckBoxWrapper.find('input[type=checkbox]').not("[disabled]").prop('checked', true)
			sgCheckBoxWrapper.fadeIn();
        }else{
			sgCheckBoxWrapper.fadeOut();
			sgCheckBoxWrapper.find('input[type=checkbox][current="true"]').not("[disabled]").prop('checked', true)
			sgCheckBoxWrapper.find('input[type=checkbox][current="false"]').prop('checked', false)
        }
    })
};

sgBackup.initImportTooltips = function () {
    jQuery('a[data-toggle=tooltip]').tooltip();
};

sgBackup.initManualBackupTooltips = function(){
    jQuery('[for=cloud-ftp]').tooltip();
    jQuery('[for=cloud-dropbox]').tooltip();
    jQuery('[for=cloud-gdrive]').tooltip();
    jQuery('[for=cloud-one-drive]').tooltip();
    jQuery('[for=cloud-amazon]').tooltip();

    jQuery('a[data-toggle=tooltip]').tooltip();
};

sgBackup.startRestore = function(bname) {

	jQuery('.alert').remove();
	var type = jQuery('input[type=radio][name=restoreType]:checked').val();
	var restoreFilesType = jQuery('input[type=radio][name=restoreFilesType]:checked').val() || "0";
    var paths = restoreFilesType == "0"? "/" : jQuery("#fileSystemTreeContainer").jstree("get_selected");
	var checkPHPVersionCompatibility = new sgRequestHandler('checkPHPVersionCompatibility',{bname: bname});

	checkPHPVersionCompatibility.callback = function(response) {
		if (typeof response.error != 'undefined') {
			alert(response.error);
			return false;
		}
		else if (typeof response.warning != 'undefined') {
			if (!confirm(response.warning)) {
				return false;
			}
		}

		sgBackup.showAjaxSpinner('#sg-content-wrapper');
		var resetStatusHandler = new sgRequestHandler('resetStatus');
		resetStatusHandler.callback = function(response) {
			//If error
			if(typeof response.success === 'undefined') {
				alert(response);
				location.reload();
				return false;
			}
			var restoreHandler = new sgRequestHandler('restore',{bname: bname, type:type, paths:paths});
			restoreHandler.run();
			sgBackup.checkRestoreCreation();
		};
		resetStatusHandler.run();
	};

    if (type == "files" && restoreFilesType == 1) {
        var isFeatureAvailable = new sgRequestHandler('isFeatureAvailable', {sgFeature: "SLECTIVE_RESTORE"});
        isFeatureAvailable.callback = function (response) {
            if (typeof response.success != 'undefined') {
                checkPHPVersionCompatibility.run();
            }
            else {
                var alert = sgBackup.alertGenerator(response.error, 'alert-warning');
                jQuery('#sg-modal .modal-header').prepend(alert);
                return false;
            }
        }

        isFeatureAvailable.run();
    }
    else {
        checkPHPVersionCompatibility.run();
    }
};

sgBackup.initActiveAction = function(){
    if(jQuery('.sg-active-action-id').length<=0){
        return;
    }

    var activeActionsIds = [];
    jQuery('.sg-active-action-id').each(function() {
        activeActionsIds.push(jQuery(this).val());
    });

    //Cancel Button
    jQuery('.sg-cancel-backup').click(function(){
        if (confirm('Are you sure?')) {
            var actionId = jQuery(this).attr('sg-data-backup-id');
            var sgCancelHandler = new sgRequestHandler('cancelBackup', {actionId: actionId});
            sgCancelHandler.run();
        }
    });

    for (var i = 0; i < activeActionsIds.length; i++) {
        //GetProgress
        sgBackup.getActionProgress(activeActionsIds[i]);
    }
};

sgBackup.getActionProgress = function(actionId){
    var progressBar = jQuery('.sg-progress .progress-bar', '#sg-status-tabe-data-'+actionId);

    var sgActionHandler = new sgRequestHandler('getAction', {actionId: actionId});
    //Init tooltip
    var statusTooltip = jQuery('#sg-status-tabe-data-'+actionId+'[data-toggle=tooltip]').tooltip();

    sgActionHandler.callback = function(response){
        if(response){
            sgBackup.disableUi();
            var progressInPercents = response.progress+'%';
            progressBar.width(progressInPercents);
            sgBackup.statusUpdate(statusTooltip, response, progressInPercents);
            setTimeout(function () {
                sgActionHandler.run();
            }, SG_CHECK_ACTION_STATUS_REQUEST_FREQUENCY);
        }
        else{
            jQuery('[class*=sg-status]').addClass('active');
            jQuery('.sg-progress').remove();
            jQuery('.sg-active-action-id').remove();
            location.reload();
        }
    };
    sgActionHandler.run();
};

sgBackup.statusUpdate = function(tooltip, response, progressInPercents){
    var tooltipText = '';
    if(response.type == '1'){
        var currentAction = 'Backup';
        if (response.status == '1') {
            tooltipText = currentAction + ' database - '+progressInPercents;
        }
        else if (response.status == '2') {
            tooltipText = currentAction + ' files - '+progressInPercents;
        }
        jQuery('.sg-status-'+response.status).prevAll('[class*=sg-status]').addClass('active');
    }
    else if(response.type == '2'){
        var currentAction = 'Restore';
        if (response.status == '1') {
            tooltipText = currentAction + ' database - '+progressInPercents;
        }
        else if (response.status == '2') {
            tooltipText = currentAction + ' files - '+progressInPercents;
        }
        jQuery('.sg-status-'+response.type+response.status).prevAll('[class*=sg-status]').addClass('active');
    }
    else if(response.type == '3'){
        var cloudIcon = jQuery('.sg-status-'+response.type+response.subtype);
        if(response.subtype == '1'){
            tooltipText = 'Uploading to FTP - '+progressInPercents;
        }
        else if(response.subtype == '2'){
            tooltipText = 'Uploading to Dropbox - '+progressInPercents;
        }
        else if(response.subtype == '3'){
            tooltipText = 'Uploading to Google Drive - '+progressInPercents;
        }
        else if(response.subtype == '4') {
            tooltipText = 'Uploading to Amazon S3 - '+progressInPercents;
        }
        cloudIcon.prevAll('[class*=sg-status]').addClass('active');
    }
    tooltip.attr('data-original-title',tooltipText);
};

sgBackup.disableUi = function(){
    jQuery('#sg-manual-backup').attr('disabled','disabled');
    jQuery('#sg-backup-with-migration').attr('disabled','disabled');
    jQuery('#sg-import').attr('disabled','disabled');
    jQuery('.sg-restore').attr('disabled','disabled');
};

sgBackup.enableUi = function(){
    jQuery('#sg-manual-backup').removeAttr('disabled');
    jQuery('#sg-import').removeAttr('disabled');
    jQuery('.sg-restore').removeAttr('disabled');
};

sgBackup.initBackupDeletion = function(){
    jQuery('.sg-remove-backup').click(function(){
        var btn = jQuery(this),
            url = btn.attr('data-remote'),
            backupName = [btn.attr('data-sgbackup-name')];
        if (confirm('Are you sure?')) {
            var ajaxHandler = new sgRequestHandler(url, {backupName: backupName});
            ajaxHandler.callback = function (response) {
                location.reload();
            };
            ajaxHandler.run();
        }
    });
};
