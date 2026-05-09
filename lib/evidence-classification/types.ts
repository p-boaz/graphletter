/**
 * Type definitions for evidence classification system
 */

export interface IAMConfiguration {
  users: Array<{
    UserName: string;
    UserId: string;
    CreateDate: string;
  }>;
  mfaDevices: Array<{
    UserName: string;
    SerialNumber: string;
    EnableDate: string;
  }>;
  accountSummary: {
    Users: number;
    MFADevices: number;
    MFADevicesInUse: number;
    [key: string]: unknown;
  };
  passwordPolicy: {
    MinimumPasswordLength?: number;
    RequireSymbols?: boolean;
    RequireNumbers?: boolean;
    RequireUppercaseCharacters?: boolean;
    RequireLowercaseCharacters?: boolean;
    AllowUsersToChangePassword?: boolean;
    ExpirePasswords?: boolean;
    error?: string;
  } | null;
}

export interface S3Configuration {
  buckets: Array<{
    Name: string;
    CreationDate: string;
  }>;
  bucketEncryption: {
    [bucketName: string]: {
      Rules?: Array<{
        ApplyServerSideEncryptionByDefault: {
          SSEAlgorithm: string;
          KMSMasterKeyID?: string;
        };
        BucketKeyEnabled?: boolean;
      }>;
    } | null;
  };
  bucketPublicAccess: {
    [bucketName: string]: {
      BlockPublicAcls?: boolean;
      IgnorePublicAcls?: boolean;
      BlockPublicPolicy?: boolean;
      RestrictPublicBuckets?: boolean;
    } | null;
  };
  bucketVersioning: {
    [bucketName: string]: {
      Status?: string;
      MfaDelete?: string;
    } | null;
  };
}

export interface AWSData {
  iam?: IAMConfiguration;
  s3?: S3Configuration;
  cloudwatch?: unknown;
  inspector2?: unknown;
  rds?: unknown;
  dynamodb?: unknown;
  ecr?: unknown;
  lambda?: unknown;
  logs?: unknown;
}
