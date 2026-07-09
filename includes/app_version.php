<?php
/**
 * Shared application version helpers.
 */

const ISKOOL_APP_VERSION = '1.1.3';

function iskool_app_version(): string
{
    return ISKOOL_APP_VERSION;
}

function iskool_app_version_label(): string
{
    return 'iSkool v' . ISKOOL_APP_VERSION;
}
