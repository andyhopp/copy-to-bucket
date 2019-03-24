# CopyRepoToCodeCommit

This Lambda is designed to copy the contents from a publicly-accessible S3 bucket to another. Quite handy for copying static Web sites.

This version is intended to be used as a CloudFormation Custom Resource and will look for five properties:
* SourceBucketName - the name of the bucket that contains the content.
* SourceBucketPrefix - [optional] a prefix from which the copies will be made.
* TargetBucketName - the name of a CodeCommit repository
* TargetBucketPrefix - [optional] a prefix into which the copies will be placed. 
* ACL: The ACL to use for the copied content
* Retain: [optional] whether to delete the copied content when the stack is deleted.

## Example Usage
``` yaml
  MyBucket:
    Type: AWS::S3::Bucket

  CopyToBucketFunction:
    Type: AWS::Serverless::Application
    Properties:
      Location:
        ApplicationId: arn:aws:serverlessrepo:us-east-1:982831078337:applications/CopyToBucket
        SemanticVersion: 1.0.0
  
  CopyToBucket
    Type: Custom::CopyToBucket
    DependsOn: [ CopyToBucketFunction, MyBucket ]
    Properties:
      ServiceToken: !GetAtt CopyToBucketFunction.Outputs.FunctionArn
      SourceBucketName: mysourcebucketname
      SourceBucketPrefix: myapp/static-content
      TargetBucketName: !Ref MyBucket
```
