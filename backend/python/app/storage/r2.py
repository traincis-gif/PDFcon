import boto3
from botocore.config import Config

from app.config import Settings


def _get_s3_client(settings: Settings):
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(
            signature_version="s3v4",
            region_name="auto",
        ),
    )


def generate_presigned_upload(
    object_key: str,
    settings: Settings,
    expires_in: int = 3600,
    content_type: str = "application/pdf",
) -> str:
    client = _get_s3_client(settings)
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


def generate_presigned_download(
    object_key: str,
    settings: Settings,
    expires_in: int = 3600,
) -> str:
    client = _get_s3_client(settings)
    url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": object_key,
        },
        ExpiresIn=expires_in,
    )
    return url


def upload_file_bytes(
    object_key: str,
    data: bytes,
    settings: Settings,
    content_type: str = "application/pdf",
) -> str:
    client = _get_s3_client(settings)
    client.put_object(
        Bucket=settings.r2_bucket_name,
        Key=object_key,
        Body=data,
        ContentType=content_type,
    )
    if settings.r2_public_url:
        return f"{settings.r2_public_url}/{object_key}"
    return generate_presigned_download(object_key, settings)


def download_file_bytes(object_key: str, settings: Settings) -> bytes:
    client = _get_s3_client(settings)
    response = client.get_object(
        Bucket=settings.r2_bucket_name,
        Key=object_key,
    )
    return response["Body"].read()
