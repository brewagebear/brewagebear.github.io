---
emoji: ๐งข
title: ๋ฆฌ๋์ค(CentOS7)์์ ์๋ฐ ๊ฐ๋ฐํ๊ฒฝ ๊ตฌ์ถํ๊ธฐ - Nginx์ Tomcat์ฐ๋
date: 2018-08-05 16:34:00 +0900
tags: 
- Linux
- centOS7
- Tomcat
- Nginx
- setting_environment
author: ๊ฐ๋ฐํ์
categories: ์ธํ๋ผ
---

```toc
```

# ๊ฐ์
์ด์ ์ฅ์ ํตํด์ ์ฐ๋ฆฌ๋ ๋ฆฌ๋์ค ์์์ jdk์ ํฐ์บฃ์ ์ค์น ๋ฐ ํ๊ฒฝ์ค์ ์ ํ์๋ค.
์ด๋ฒ ์ฅ์์๋ nginx์ reverse proxy๊ธฐ๋ฅ์ ์ด์ฉํ์ฌ ํฐ์บฃ๊ณผ ์์ง์์ค๋ฅผ ์ฐ๋ํ๋ ๋ฐฉ๋ฒ์ ์์๋ณด๋๋กํ๊ฒ ๋ค.

# Nginx์ Apache Tomcat ์ฐ๋ํ๊ธฐ
 
+ STEP 1 - Nginx์ค์นํ๊ธฐ
   + STEP 1.1 - Install Nginx using webtatic repo **(๋น์ถ์ฒ)**
     + STEP 1.1.1 EPEL ์ค์นํ๊ธฐ
     + STEP 1.1.2 Webatic ์ ์ฅ์ ์ค์นํ๊ธฐ
     + Troubleshooting 
   + SETP 1.2 - Install Nginx using Nginx official repo **(์ถ์ฒ)**
+ STEP 2 - Nginx๋ฅผ ์ฌ์ฉํ๋ ์ด์ 
	+ STEP 2.1 - Nginx ๊ฐ์ํธ์คํธ ์ค์  **(์ฐธ๊ณ ๋ง ํ์)**
	+ STEP 2.2 - Nginx reverse proxy Tomcat์ ์ ์ฉ
+ REFERENCE

- - - -

## STEP 1 - Nginx์ค์นํ๊ธฐ

### STEP 1.1 - Install Nginx using webtatic repo **(๋น์ถ์ฒ)**
์ด๋ฒ์๋ ๋ฐ์ด๋๋ฆฌ ํ์ผ์ ๋ค์ด๋ก๋ํด์ ์ค์นํ๋๊ฒ ์๋๋ผ webtatic์ด๋ผ๋ ํ๋ก๊ทธ๋จ์ ํตํด์ ์ต์  ํ๋ก๊ทธ๋จ์ ์ค์นํด๋ณด๋๋ก ํ๊ฒ ๋ค.
- - - -
#### STEP 1.1.1 EPEL์ค์นํ๊ธฐ
๋จผ์  webtatic์ ์ค์นํ๊ธฐ ์ํด์๋ EPLE(Extra Pakage for Enterprise Linux) [^1]๋ผ๋ ํ๋ก๊ทธ๋จ์ด ์ ํ์ค์น๊ฐ ํ์ํ๋ค.
EPLE์ ๋ํด์ ๊ฐ๋จํ ์ค๋ชํ๋ฉด, ์ฐ๋ฆฌ๊ฐ ์ฐ๋ ๋ฆฌ๋์ค OS๋ RHEL๊ณ์ด ๋ฐฐํฌํ์ธ๋ฐ RHEL์ ์ต์ ๋ฒ์ ์ ํ๋ก๊ทธ๋จ์ ์ฌ์ฉ๋ณด๋ค๋ ์์ ์ฑ์ ์ต์ฐ์ ์ผ๋ก ํ๋ค. ๋ฐ๋ผ์ ํจํค์ง ์๋ฐ์ดํธ๊ฐ ์ ์๋๋๋ฐ ์ด๋ฌํ ๊ฒ์ EPEL์ ์ฌ์ฉํ์ฌ ํด๊ฒฐํ  ์๊ฐ ์๋ค.

๊ฐ๋จํ ์๊ธฐํ๋ฉด yum์ ์๋ ํจํค์ง๋ ์ต์ ๋ฒ์ ์ด ์๋ ํจํค์ง๋ฅผ ๋ค์ด๋ฐ์ ์ ์๊ฒํ๋ ์ญํ ์ ํ๋ค๊ณ  ์๊ฐํ๋ฉด ๋๋ค.

๋ฐ๋ผ์ ์ต์  ํจํค์ง๋ฅผ ์ฌ์ฉํ๊ธฐ ์ํด์๋ epel๋ remi, webtatic ์ ์ฅ์๋ฅผ ์ด์ฉํ๋๊ฒ ํธํ๋ค.

์ค์น๋ฒ์ ๋งค์ฐ ๊ฐ๋จํ๋ค.
CentOS7 ํ๊ฒฝ์์๋ ๋จ์ํ๊ฒ ์๋์ ๋ช๋ น์ด๋ฅผ ์๋ ฅํ๋ฉด ๋๋ค.
> rpm -Uvh https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm   
>    
์คํ๊ฒฐ๊ณผ๋ ์๋์ ๊ฐ์ด ๋์จ๋ค. 
ํ์๋ ์ด๋ฏธ ์ค์น๋์ด์ ์ด๋ฏธ ์ค์น๋์ด์๋ค๊ณ  ๋์จ๋ค.

```console 
[root@AzureCentOS azureuser]# rpm -Uvh https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
Retrieving https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
warning: /var/tmp/rpm-tmp.loyNno: Header V3 RSA/SHA256 Signature, key ID 352c64e5: NOKEY
Preparing...                          ################################# [100%]
```
- - - -

#### STEP 1.1.3 Webtatic์ ์ฅ์ ์ค์นํ๊ธฐ
๋ค์ํ ํ์ฅ ์ ์ฅ์๊ฐ ์์ง๋ง (remi, IUS ๋ฑ) ๊ทธ๊ฒ์ ์ถํ์ ํฌ์คํํ๋๋กํ๊ณ , Nginx ์ต์ ์์ ๋ฒ์ ์ ๋ฐ์ ์ ์๋ webtatic์ ์ด์ฉํด์ Nginx๋ฅผ ๋ค์ด๋ฐ๊ธฐ๋ก ํ๋ค. 

> ์ด๊ฒ์ ๋ฐ์์ Nginx ๊ณต์์ ์ฅ์๋ก ๋ค์ด๋ฐ๋๊ฑฐ์ ๋นํด์ ๊ถ์ฅ๋์ง๋ ์์ผ๋ ์ด๋ฐ๊ฒ ์๊ตฌ๋์ ๋๋ก ๋์ด๊ฐ๋ฉด ๋๊ฒ ๋ค.  

epel๊ณผ ๋ง์ฐฌ๊ฐ์ง๋ก ์์ฃผ ์ฝ๊ฒ ์ค์นํ  ์๊ฐ ์๋ค.
> rpm -Uvh https://mirror.webtatic.com/yum/el7/webtatic-release.rpm    

๊ทธ ํ์ yum repolist๋ก repository๊ฐ ์ ๋ฑ๋ก๋์๋์ง ํ์ธํ๋ค.

```console
[root@AzureCentOS azureuser]# yum repolist
Loaded plugins: fastestmirror
Repository nodesource is listed more than once in the configuration
Repository nodesource-source is listed more than once in the configuration
Loading mirror speeds from cached hostfile
 * epel: mirror.premi.st
 * remi-safe: ftp.riken.jp
 * webtatic: sp.repo.webtatic.com
repo id                                        repo name 
...       
```

> Loading mirror speeds from cached hostfile     
 epel: mirror.premi.st  
 webtatic: sp.repo.webtatic.com  

์ด๋ฐ์์ ๋ฌธ๊ตฌ๊ฐ ๋์จ๋ค๋ฉด ์ฑ๊ณต์ ์ผ๋ก ์ค์น๊ฐ ๋ ๊ฒ์ด๋ค.
๋ง์ผ ์  ๋ฌธ๊ตฌ๊ฐ ๋์ค์ง ์๋๋ค๋ฉด, 
> sudo  vi /etc/yum.repos.d/webtatic.repo    
๋ช๋ น์ด๋ฅผ ์๋ ฅํ์ **enable=1**๋ก ์์ ํ๋ค.

๊ทธ๋ฆฌ๊ณ  webtatic๋ณด๋ค nginx ๊ณต์ ์ ์ฅ์๋ฅผ ์ถ์ฒํ๋ ์ด์ ๊ฐ ์ด์ ์์ผ ๋์ค๋๋ฐ ์ง๊ธ ๊ธ ์์ฑ ์์  ('18.07.22)์์ nginx LTS๋ฒ์ ์ **1.14.0**์ด๋ค. 
ํ์ง๋ง webtatic ์ ์ฅ์์ ๋ฒ์  [^2]์ 1.10.3์ผ๋ก ๋ ๊ฑฐ์๋ฒ์ ์ด๋ค. 
์ด ๋ฒ์ ์ ์ด์ฉํ๋ ค๋ ์ฌ๋์ ์ค์นํด๋ ๋ฌด๋ฐฉํ๋ ์ ๋งํ๋ฉด nginx ๊ณต์ ์ ์ฅ์๋ฅผ ์ด์ฉํ ์ค์น๋ฅผ ์ถ์ฒํ๋ค. 

๋ํ 1.10.3์ ๋ฐ๋ก ์ค์นํ๋ ๋ฐฉ๋ฒ์ด ์๋๋ผ 1.8๋ฒ์ ์ ์ค์น ํ  ์๊ทธ๋ ์ด๋ ํ๋ ๋ฐฉ์ [^3]์ ์ทจํ๋ค.    

์ผ๋จ yum๋ง๊ณ  ๋ค๋ฅธ ์ ์ฅ์๋ฅผ ์ฌ์ฉํ๋ค๋๋ฐ์ ์์๋ฅผ ๋๊ณ  (๊ณต๋ถ๋ชฉ์ ) ์์์ ์ธ๊ธํ ๋ฐ์ ๊ฐ์ด
> "์ด๋ฐ ๋ฐฉ๋ฒ์ด ์๊ตฌ๋!!" ์๊ฐํ๊ณ  ๋์ด๊ฐ์.  

๋ง์ฝ ๋ ์ฌ๊ธฐ๊น์ง ์๊ณ , ๊ทธ๋ฅ webtatic์ ์ฌ์ฉํ์ฌ ์ค์นํ๊ณ  ์ถ๋ค๋ ๋ถ๋ค์ ์ํด์ ๊ณ์ํด์ ๋ฐฉ๋ฒ์ ์ ์ด๋ณด๋๋ก ํ๊ฒ ๋ค.

์ดํ์ ๋จ๊ณ๋ Webtatic์ ์ฅ์๋ฅผ ์ด์ฉํ์ฌ Nginx1.8๋ฅผ ์ค์น ํ์ 1.10.3์ ์๊ทธ๋ ์ด๋ํ๋ ๋จ๊ณ๊ฐ ๋จ์์๋ค.

๋จผ์  webtatic์ ์ฅ์๋ฅผ ์ด์ฉํ์ฌ ์ค์นํ๋ ๋ฐฉ๋ฒ์ ๋งค์ฐ ๊ฐ๋จํ๋ค ์์ ๋จ๊ณ๋ฅผ ์ฐฉ์คํ ์ํํ๋ค๋ฉด ์๋์ ๋ช๋ น์ด๋ฅผ ์๋ ฅํ๋ค.
> yum install nginx18    

๊ทธ๋ฌ๋ฉด ์์ ์ CentOS7์ nginx์ค์น๋ ์๋ฃ๋๋ฉฐ ๊ด๋ จ ์ค์ ํ์ผ๋ค์ (ex : nginx.conf) **/etc/nginx** ๊ฒฝ๋ก์์ ์๋ค. 

์ด์  ๋ฐ๋ก Nginx1.8๋ฒ์ ์ 1.10.3์ผ๋ก ์๊ทธ๋ ์ด๋๋ฅผ ํด๋ณด์!
> yum install yum-plugin-replace    
  yum replace nginx18 --replace-with=nginx1w  
  systemctl restart nginx  

์์ ๋ช๋ น์ด๋ฅผ ์๋ ฅํ๋ฉด 1.8 ๋ฒ์  nginx๊ฐ 1.10.3์ผ๋ก ๋์ฒด๊ฐ ๋๋ค.

ํด๋น ๋ช๋ น์ด๋ก ์๊ทธ๋ ์ด๋ํ  ์์ 
> WARNING: Unable to resolve all providers โฆ     

์ด๋ฌํ ์๋ฌ๊ฐ ๋์ค๋ฉด ์ ์์ ์ธ ์ํฉ์ด๋๊น ๋นํฉํ์ง๋ง๊ณ  **y**๋ฅผ ์๋ ฅํ์!

- - - -

#### Troubleshooting
๋ง์ฝ ์ค์น๊ฐ ์ ๋๋ก ์๋๋ค๋ฉด, ๊ณต์์ฌ์ดํธ์์๋ ํด๋น ๋ช๋ น์ด๋ฅผ ์๋ ฅํด๋ณด๋ ๊ฒ์ ๊ถ์ฅํ๊ณ  ์๋ค.
```console
yum shell
remove nginx18
install nginx1w
run
systemctl restart nginx
```
- - - -
### SETP 1.2 - Install Nginx using Nginx official repo (**์ถ์ฒ**)
ํ์๋ ์ด ๋ฐฉ๋ฒ์ผ๋ก Nginx๋ฅผ ์ค์นํ๋๊ฒ์ ๊ถ์ฅํ๊ณ ์๋ค!

RHEL ๋ฐฐํฌํ์๋ Nginx์ ํฌํจํ๊ณ  ์์ง์์ผ๋ฏ๋ก, Nginx repo๋ฅผ ์ง์  ์ถ๊ฐํด์ค์ผํ๋ค.

์๋์ ๋ช๋ น์ด๋ฅผ ๋ฐ๋ผํ์! 
```console
[azureuser@AzureCentOS ~]$ sudo vi /etc/yum.repos.d/nginx.repo

#vi ํธ์ง๊ธฐ๋ฅผ ์ฐ ํ์ ์๋์ ๋ด์ฉ ์์ฑ

[nginx]
name=Nginx Repository \$basearch - Archive 
baseurl=http://nginx.org/packages/centos/\$releasever/\$basearch/
enabled=1
gpgcheck=1
gpgkey=https://nginx.org/keys/nginx_signing.key

#์ ์ฅ ํ์ (wq) ์ ๋๋ก ์ ์ฉ๋๋์ง ํ์ธ
[azureuser@AzureCentOS ~]$ yum info nginx
Installed Packages
Name        : nginx
Arch        : x86_64
Epoch       : 1
Version     : 1.14.0
Release     : 1.el7_4.ngx
Size        : 2.6 M
Repo        : installed
From repo   : nginx
Summary     : High performance web server
URL         : http://nginx.org/
License     : 2-clause BSD-like license
Description : nginx [engine x] is an HTTP and reverse proxy server, as well as
            : a mail proxy server.
```
ํ์ ๊ฐ์ ๊ฒฝ์ฐ์๋ ์ค์น๊ฐ ๋์ด์์ผ๋ฏ๋ก, **installed**๋ผ๊ณ  ๋์จ๋ค. 
1.14.0 (LTS)๋ฒ์ ์ด ์ค์น๋ ๊ฒ์ ํ์ธํ  ์๊ฐ ์๋ค.

์ค์น ๋ฐ ๋ถํ์ ์๋ ๊ตฌ๋ํ๋๋ก ์ค์ ํ๊ธฐ ์ํด์๋
```console
[azureuser@AzureCentOS ~]$ sudo yum install nginx

#์ค์น ์๋ฃ ํ ์์๋ฐ๋ชฌ ๋ฑ๋ก 
[azureuser@AzureCentOS ~]$ sudo systemctl enable nginx
[azureuser@AzureCentOS ~]$ sudo systemctl restart nginx
```
์ด๋ ๊ฒ ํ๋ฉด nginx ๊ณต์ ์ ์ฅ์๋ฅผ ์ด์ฉํ์ฌ nginx๋ฅผ ์ค์นํ๋ ๊ฒ์ ๋๋ผ ์๊ฐ ์๋ค.

- - - -
## STEP 2 - Nginx๋ฅผ ์ฌ์ฉํ๋ ์ด์ 
Tomcat์ ์ฌ์ฉํ๋๋ฐ ์ Nginx๋ฅผ ๊ตณ์ด ์ธ๊น? ํ๋ ์ด์ ๋ฅผ ๊ฐ๋ ์ฌ๋๋ค์ด ๋ง์ ๊ฒ์ด๋ค.
์ผ๋จ ๋จผ์  ์ฐจ์ด์ ์ ์์์ผํ๋ค. Tomcat์ ์๋ธ๋ฆฟ ์ปจํ์ด๋๋ฅผ ํฌํจํ WAS(Web Application Server)์ด๋ค. Nginx๋ ๊ฐ๋ ฅํ๊ณ  ๋จ์ํ ์น์๋ฒ๋ก์ ํนํ, ๊ฐ์ํธ์คํธ ์ค์ ๊ณผ ๋ฆฌ๋ฒ์ค ํ๋ก์๋ฅผ ๊ตฌ์ถํ๋๋ฐ ์์ฃผ ์ฌ์ฉ๋๋ ์น์๋ฒ์ด๋ค.

์ฆ, ์ฌ์ฉ์์ Http ์์ฒญ์ Http Server(= Web Server)๋ก ๋ฐ์ ํ์ ๋ค์ ์น์๋ฒ๊ฐ WAS์ ํ์ํ ๋ด์ฉ์ ์ ๋ฌํ ํ์ WAS์์ ์ฒ๋ฆฌ ํ์ ๋ค์ ์น์๋ฒ๊ฐ ํด๋ผ์ด์ธํธ์๊ฒ ํํํ๋ ์์ผ๋ก ๊ตฌํํ๋ ๊ฒ์ด๋ค. 

![์น์๋ฒ์ WAS์ ์ฒ๋ฆฌ ๋ฐฉ๋ฒ](../assets/images/EFD108B9-A993-4AFA-8473-4EDF05EE6AD6.png)

ํด๋น ๋ด์ฉ์ ์ด๋ฏธ์ง์ธ ์ถ์ฒ์ธ [WAS์ ์น์๋ฒ์ ์ฐจ์ด](http://gap85.tistory.com/45)์์ ์์ธํ๊ฒ ํ์ธํ  ์๊ฐ ์๋ค. ๊ฐ๋จํ๊ฒ ์ค๋ชํ์๋ฉด, ํฐ์บฃ์ ๋์  ์๋ฒ์ฝํ์ธ ๋ฅผ ์ํํ๊ณ , ์น์๋ฒ๋ ์ ์  ์๋ฒ์ฝํ์ธ ๋ฅผ ์ํํ๋ค๋ ์ ์ด๋ค.

๊ทธ๋ฆฌ๊ณ  Nginx๋ ๊ฐ์ฅ ํฐ ์ฅ์ ์ธ ๋งค์ฐ ์ฌ์ด ๊ฐ์ํธ์คํธ ์ค์ ์ผ๋ก ํ๋์ ์๋ฒ์์ ์ฌ๋ฌ๊ฐ์ ์น์๋ฒ๋ฅผ ๊ตฌ๋ํจํ๋ ์ฅ์ ์ ๊ฐ๋๋ค.

![Nginx ๊ฐ์ํธ์คํธ](../assets/images/EF22FD5B-744C-4780-9D1A-BCF9FF7AEDB8.gif)

์์ ๋์ํ๋ฅผ ๋ณด๋ฉด ์ดํด๊ฐ ๋  ๊ฒ์ด๋ค.
์ฌ์ฉ์๊ฐ news์ ๋ํ ์์ฒญ์ ํ๋ฉด ํด๋น ๋๋ฉ์ธ์ ์ฎ์ธ ๋ถ๋ถ์ Nginx๊ฐ ์ฝ๊ณ , ํด๋น ๋๋ ํ ๋ฆฌ์ ์๋ ์ฝํ์ธ ๋ฅผ ์๋ตํ๊ณ , blog์ ๋ํ ์ง์๋ฅผ ํ๋ฉด blog ๋๋ ํ ๋ฆฌ์ ์๋ ์ฝํ์ธ ๋ฅผ ์๋ตํ๋ค.

๊ทธ๋ฆฌ๊ณ  Reverse Proxy๋ ์ก์ธ์ค ํฌ์ธํธ๋ฅผ ์ฃผ์ด์ ๊ฐ๊ธฐ ๋ค๋ฅธ ๋๋ฉ์ธ์ ์ฌ์ฉํด๋, ํ ์ก์ธ์ค ํฌ์ธํธ์์ ๋ก๊ทธ๊ด๋ฆฌ์ ํด๋ผ์ด์ธํธ ์์ฒญ์ ๋ง๊ฒ url ๋งคํ์ ํ๋ ๊ธฐ๋ฅ์ ์ํํ๋ค.

์๋์ ๊ทธ๋ฆผ์ ๋ณด์.
![Nginx ๋ฆฌ๋ฒ์คํ๋ก์](../assets/images/CF80CCA8-CE9D-4D9E-8B08-918D6F03CEAA.png)

์์ ๊ฐ์ ๋์์ ํตํด์ Reverse Proxy์ ์ฅ์ ์ ์ ๋ฆฌํ์๋ฉด ์๋์ ๊ฐ์ด ๋ณผ ์๊ฐ ์๋ค.

1. ์๋ฒ์ ๋ถํ๋ฅผ ๋์ด์ค์ ์๋ ๋ก๋ ๋ฐธ๋ฐ์ฑ ์ฒ๋ฆฌ
2. ๊ฐ ์๋ฒ์ ๋ถํ๋ฅผ ๋์ด์ค ๋งํผ ์น์๋ฒ ์๋ ์ฆ๋
3. ๋ณด์๊ณผ ์ต๋ช์ฑ
4. ์ค์ ์ง์ค์ log ์์ฑ๊ณผ ๊ฐ์
5. ์บ์ฌ์ฌ์ฉ

์์ ๊ฐ์ ๊ธฐ๋ฅ์ ์์ฃผ ์ฝ๊ฒ Nginx๊ฐ ์ ๊ณตํ๋ค๋ ๊ฒ์ด๋ค.
๋ฐ๋ผ์, ์์ผ๋ก๋ ๊ฐ์ํธ์คํธ ์ค์  ๋ฐ ๋ฆฌ๋ฒ์คํ๋ก์ ์ค์ ์ ํด๋ณด์ํ๋ค.

- - - -

### STEP 2.1 - Nginx๊ฐ์ํธ์คํธ์ค์  **(๋์์ํ๋๊น ์ฐธ๊ณ ๋ง ํ์!!!)**
์ฐ๋ถํฌ์ ๋ฌ๋ฆฌ (์ฐ๋ถํฌ๋ sites-enabled/ ๋๋ ํ ๋ฆฌ ์๋์ ํด๋น ๊ฐ์ํธ์คํธ ์ค์ ์ ์ง์ด ๋ฃ์ผ๋ฉด ๋์ด๋ค.) RHEL ๋ฐฐํฌํ์ ๊ฐ์ํธ์คํธ ์ค์ ์ ํ๊ธฐ๊ฐ ์ข ๋ถํธํ๋ค.

์ด๋ฒ์๋ CentOS7์์๋ ์ฐ๋ถํฌ์ฒ๋ผ ๊ฐ์ํธ์คํธ๋ฅผ ๊ด๋ฆฌํ๊ธฐ ์ํ ์ค์ ์ ํด๋ณด๊ณ ์ ํ๋ค.
์ผ๋จ, ์ฐ๋ฆฌ๊ฐ ์ค์นํ Nginx์ ๊ฒฝ๋ก๋ */etc/nginx*์ด๋ค.
์๋์ ํด๋์ ๊ฐ์ํธ์คํธ๋ฅผ ๊ด๋ฆฌํ๊ธฐ์ํ ์ค์ ์ ํด๋ณด๊ฒ ๋ค.

```console
[azureuser@AzureCentOS nginx] sudo mkdir /etc/nginx/sites-available/
[azureuser@AzureCentOS nginx] sudo mkdir /etc/nginx/sites-enabled/
```

์ดํ Nginx์ ์ค์ ํ์ผ์ธ Nginx.conf๋ฅผ ์์ ํ๋๋ฐ ์์ธํ ๋ด์ฉ์ 
[Nginx์ ๊ธฐ๋ณธ ๊ตฌ์ฑ](http://technerd.tistory.com/19)์ผ๋ก ๋์ฒดํ๊ฒ ๋ค.
๋ง์ผ ํ์ํ๋ค๋ฉด ํ์ํ ๋ถ๋ถ์ ๋ฐ๋ก ํฌ์คํํ๋๋ก ํ๊ฒ ๋ค.

์ฃผ์ ์ค์  ๋ถ๋ถ๋ง ์ ๋ฆฌํ์๋ฉด ์๋์ ๊ฐ๋ค.

**worker_processes** : ๋ณ๋์ ํ๋ก์ธ์ค๋ก ๊ตฌ๋๋์ด ์ค์  ์ฒ๋ฆฌ๋ฅผ ํ๋ ํ๋ก์ธ์ค์ ๊ฐฏ์. cpu์ core ๊ฐฏ์๋ฅผ ํ์ธํ ํ ์ด ์ซ์๋๋ก ์ฃผ๋๊ฒ ์ข๋ค.

**worker_connections** : ์์ปค ํ๋ก์ธ์ค๋น ๋์์ ์ฒ๋ฆฌํ  ์ ์๋ ์ฐ๊ฒฐ ๊ฐฏ์. ๊ธฐ๋ณธ ๊ฐ 768

**max_clients**= **worker_processes** * **worker_connections**

๊ธฐ๋ณธ ์ค์ ์์๋
[Nginx Full Example Configuration](https://www.nginx.com/resources/wiki/start/topics/examples/full/#nginx-conf)์ ์ฐธ๊ณ ํ  ์ ์๋ค.

ํ์๋ ์ด๋ฐ์์ผ๋ก ์ฌ์ฉํ๊ณ  ์๋ค.
```console
# For more information on configuration, see:
#   * Official English Documentation: http://nginx.org/en/docs/
#   * Official Russian Documentation: http://nginx.org/ru/docs/

user  nginx;
worker_processes  4;
error_log  /var/log/nginx/error.log;  
pid        /var/run/nginx.pid;
 
events {
    worker_connections  2048;
}
 
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
  access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    #tcp_nopush     on;
    #keepalive_timeout  0;
    keepalive_timeout  65;
    server_tokens off;
    gzip  on;
    gzip_disable "msie6";
    ##
    # SSL Settings
    ##
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2; # Dropping SSLv3, ref: POODLE
    ssl_prefer_server_ciphers on;
    # Virtual Host Configs
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

๋ง์ฝ, www.aaa.com๊ณผ www.bbb.com์ด๋ผ๋ ๋ ๊ฐ์ ๋๋ฉ์ธ์ ํ ์๋ฒ์์ ๋์ํ๊ธฐ ์ํด์๋ ์๋์ ๊ฐ์ด ํ๋ค.

ํ์๋ 3๊ฐ์ง์ ํ์ผ์ ๋ง๋ค์๋๋ฐ 
1. default (tomcat upstream ํ์ผ)
2. www.aaa.com (www.aaa.com ๊ฐ์ํธ์คํธ ์ค์  ํ์ผ)
3. www.bbb.com (www.bbb.com ๊ฐ์ํธ์คํธ ์ค์  ํ์ผ)

```console
    [root@AzureCentOS nginx]# cd sites-enabled/
    [root@AzureCentOS sites-enabled]# vi default
    
    # default ํ์ผ
    upstream tomcat {
     server  127.0.0.1:8080  fail_timeout=0;
    }

    [root@AzureCentOS sites-enabled]# vi www.aaa.com 
    #www.aaa.com ์ค์ ํ์ผ
          location / {
                  proxy_redirect off;
                  proxy_pass_header Server;
 
                  proxy_set_header Host $http_host;
                  proxy_set_header X-Forwarded-Proto $scheme;
                  proxy_set_header X-Forwarded-Port $server_port;
                  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                  proxy_set_header X-Real-IP $remote_addr;
                  proxy_set_header X-Scheme $scheme;
                  proxy_pass http://tomcat;
                  charset utf-8;
          }
    }

    [root@AzureCentOS sites-enabled]# vi www.bbb.com
    #www.bbb.com ์ค์ ํ์ผ
         location / {
                  proxy_redirect off;
                  proxy_pass_header Server;
 
                  proxy_set_header Host $http_host;
                  proxy_set_header X-Forwarded-Proto $scheme;
                  proxy_set_header X-Forwarded-Port $server_port;
                  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                  proxy_set_header X-Real-IP $remote_addr;
                  proxy_set_header X-Scheme $scheme;
                  proxy_pass http://tomcat;
                  charset utf-8;
          }
    }
```

์ด๋ฐ์์ผ๋ก ์ค์  ํ ํ์ tomcat์ server.xml ํ์ผ์ ์์ ํ๋ค.
```console
[root@AzureCentOS nginx]# cd /opt/tomcat/
[root@AzureCentOS tomcat]# vi conf/server.xml
<Connector port="8080" protocol="HTTP/1.1"
               connectionTimeout="20000"
               URIEncoding="UTF-8"
               address="127.0.0.1" (๊ธฐ์กด server.xml์์ ์ถ๊ฐ)
               redirectPort="8443" />

...
    #ํธ์คํธ ์ค์ 
    <Host name="www.aaa.com" appBase="/var/www/aaa" autoDeploy="true"  xmlValidation="false" xmlNamespaceAware="false">
              <Context path="/" docBase="" reloadable="true" />
      </Host>
      <Host name="www.bbb.com" appBase="/var/www/bbb" autoDeploy="true"  xmlValidation="false" xmlNamespaceAware="false">
              <Context path="/" docBase="" reloadable="true" />
      </Host>
  </Engine>
  </Service>
</Server> 
```

์ด๋ฐ์์ผ๋ก ์ค์ ํ๋ ๊ฒ์ด ๊ฐ์ ํธ์คํธ์ด๋ค.
์ด๋ฒ์๋ server.xml์ ํธ์คํ์ ์ด์ฉํ์ฌ ๋ฉํฐ๋๋ฉ์ธ์ ์ ์ฉํ์ง๋ง, ์ฐจํ์ ๋ฌด์ค๋จ ๋ฐฐํฌ๋ฅผ ๊ตฌํํ๋ ์์ค์ ๋ฐ๋ก ๋ ํฐ์บฃ๊ณผ Nginx๋ฅผ ๋ฏ์ด ๊ณ ์น  ๊ฒ์ด๋ ์ฐธ๊ณ ๋งํ์.

- - - -
### STEP 2.2 - Nginx & Apache Tomcat ๋ฆฌ๋ฒ์คํ๋ก์์ค์ 
์ด๋ฒ์๋ ์์ฃผ ๊ฐ๋จํ ๋ฆฌ๋ฒ์คํ๋ก์๋ฅผ ๊ตฌํํด๋ณด๋ คํ๋ค. 

Nginx๋ css, html, js๊ฐ์ ํ์ผ๋ง ์ฒ๋ฆฌํ๊ณ , jsp์ฒ๋ฆฌ๋ tomcat์ ๋งก๊ธฐ๋ ์์ผ๋ก ๋ฆฌ๋ฒ์คํ๋ก์๋ฅผ ์ค์ ํ๋ ค๊ณ  ํ๋ค. 

์ฆ, ์ ์ ์ฝํ์ธ ๋ Nginx๊ฐ ์ฒ๋ฆฌํ๊ณ , ๋์ ์ฝํ์ธ ๋ Tomcat์ด ์ฒ๋ฆฌํ๋ ๋ถ๋ถ์ด๋ค.
```console
[root@AzureCentOS conf.d]# cd /etc/nginx/conf.d/
[root@AzureCentOS conf.d]# vi tomcat.conf
upstream tomcat {
    ip_hash;
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name www.server.com server.com;
    access_log /var/log/nginx/test1.log;

location / {
        root /usr/share/nginx/html;
        index index.html index.htm index.jsp;
    }

    location ~ \.(css|js|jpg|jpeg|gif|htm|html|swf)$ {
        root /usr/share/nginx/html;
        index index.html index.htm;
    }

    location ~ \.(jsp|do)$ {
ย ย ย ย index index.jsp;
        proxy_pass http://tomcat;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
ย ย ย ย proxy_set_header X-NginX-Proxy true;
        proxy_set_header Host $http_host;
ย ย ย ย 
ย ย ย ย proxy_redirect off;
ย ย ย ย charset utf-8;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

์ค์ ํ์ผ์ ์ค๋ชํ์๋ฉด 
```
location ~ \.(css|js|jpg|jpeg|gif|htm|html|swf)$ {
        root /usr/share/nginx/html;
        index index.html index.htm;
    }
```

์์ ๋ถ๋ถ์ css, js, html๋ฑ ๊ธฐํ ๋ช์๋ ํ์ฅ์์ ๊ฒฝ์ฐ /usr/share/nginx/html์์ ๋ถ๋ฌ์ค๊ฒ ๋ค๋ ๋ป์ด ๋๋ค. 
๋ฐ๋ผ์ ์์ ํ์ฅ์๋ช์ ํด๋นํ๋ ํ์ผ์ tomcat์ ROOT์ ๋ ๊ฒฝ์ฐ์๋ ๋ฌด์๊ฐ ๋๋ค. 
์ฆ, Tomcat์ ์จ์ ํ *.do์ ํด๋นํ๋ ์ก์์ด๋ jspํ์ผ์ ์ฒ๋ฆฌํ๊ธฐ๋ง ํ๋ค.* 

๊ทธ๋ฌํ ์ค์ ๋ถ๋ถ์ ๋ณด์๋ฉด
```
location ~ \.(jsp|do)$ {
ย ย ย ย index index.jsp;
        proxy_pass http://tomcat;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
ย ย ย ย proxy_set_header X-NginX-Proxy true;
        proxy_set_header Host $http_host;
ย ย ย ย 
ย ย ย ย proxy_redirect off;
ย ย ย ย charset utf-8;
    }
```
์์ ์ฝ๋๋ฅผ ํตํ์ฌ ํด๋น ์ง์๋ฅผ ์ํํ๋ค๊ณ  ๋ณผ ์๊ฐ ์๋ค.
์ด๋ ๊ฒ ์ค์ ๋ ๋ฆฌ๋ฒ์คํ๋ก์๋ ํฐ์บฃ์ ๋์ ์ธ ์ฒ๋ฆฌ๋ฅผ ๋งก๊ณ , Nginx๋ ์ ์  ์ฒ๋ฆฌ๋ฅผ ๋งก์์ผ๋ก์ ๋ถํ ๋ถ์ฐ์ ํ  ์ ์๋ค๋ ์ฅ์ ์ด ์๋ค!

๋ค์์ฅ์์๋ ์๋์ ๊ฐ์ ๋ฉํฐ๋๋ฉ์ธ ๋ฆฌ๋ฒ์คํ๋ก์ ๋์๊ณผ ๊ฐ์ ์๋ฒ๋ฅผ ๊ตฌ์ถํด๋ณด๋ ๊ฒ์ ๋ฌด์ค๋จ ๋ฐฐํฌ ๊ตฌํ์ ํตํด์ ํด๋ณด๋๋ก ํ๊ฒ ๋ค.
![mulit-domain-reverse-proxy](../assets/images/D6A49F05-D5B6-4978-8CA9-590EC0EEEC83.png)

- - - -
# REFERENCE
1. [Yum ์ ์ฅ์ ์ถ๊ฐํ๊ธฐ](https://conory.com/blog/42596)
2. [RHEL/CentOS 5,6,7 ์ EPEL ๊ณผ Remi/WebTatic Repository ์ค์นํ๊ธฐ](https://www.lesstif.com/pages/viewpage.action?pageId=6979743)
3. [NGINX์์ ๋ฉํฐ์ฌ์ดํธ ์ด์ํ๊ธฐ โ ๊ฐ์ํธ์คํธ(Virtual Host) ์ค์ ๋ฒ](https://itrend.site/7/nginx์์-๋ฉํฐ์ฌ์ดํธ-์ด์ํ๊ธฐ-๊ฐ์ํธ์คํธvirtual-host-์ค์ ๋ฒ/)
4. [์ฐ๋ถํฌ NGINX(์์ง์์ค) ๊ฐ์ํธ์คํธ ์ค์ ](http://webdir.tistory.com/241)
5. [WAS์ ์น์๋ฒ์ ์ฐจ์ด โ ํฐ์บฃ๊ณผ ์ํ์น๋ฅผ ๊ตฌ๋ณํ์ง ๋ชปํ๋ ์ฌ๋์ ์ํด](http://sungbine.github.io/tech/post/2015/02/15/tomcat๊ณผ%20apache์%20์ฐ๋.html)
6. [nginX์์ reverse proxy(๋ฆฌ๋ฒ์ค ํ๋ก์) ์ฌ์ฉํ๊ธฐ](http://akal.co.kr/?p=1173)

[^1]: ~https://fedoraproject.org/wiki/EPEL~
[^2]: ~https://webtatic.com/tags/nginx/~
[^3]: ~https://webtatic.com/packages/nginx110/~
