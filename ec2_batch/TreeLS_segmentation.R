#for segmenting tree stems from MLS data using 
#package 'TreeLS' 

#cory garms
#5 March 2020

# Clear plots
if(!is.null(dev.list())) dev.off()
# Clear console
cat("\014") 
# Clean workspace
rm(list=ls())


library(TreeLS)
library(rgdal)
#library(parallel)
#library(future)

dir <- 'C:/Users/coryg/Desktop/Projects/Big_C/clouds/test'
setwd(dir)
LASlist <- list.files(dir, pattern="*.las", full.names=TRUE)

ctg <- catalog(dir)
ctg@data$File <- LASlist
td <- file.path(dir, "TreeLS_output"); dir.create(td)
LASlist <- list.files(dir, pattern="*.las", full.names=TRUE)
ctg@data$File <- LASlist

# Set the parameters
vox = 0.01 #voxel size for decimation
dens = .075 # density for hough transform
n = 10 # number of points for RANSAC
rad = 0.7 #max radius for tree

#opt_filter(ctg)       <- "-drop_z_below 0"

ctg = readLAScatalog(dir)
td <- file.path(dir, "TreeLS_output"); dir.create(td)
LASlist <- list.files(dir, pattern="*.las", full.names=TRUE)
ctg@data$File <- LASlist

##for single files
lasfile = 'tile_24.las'
las = readLAS(lasfile)

#opt_output_files(ctg) <- "./TreeLS_output"

#output <- lasfilternoise(ctg, tolerance = 1.2)

stemdetection = function(las, ...)
{
  UseMethod("stemdetection", las)
}

stemdetection.LAS = function(las, vox, dens, n, rad)
{
  thin = tlsSample(las, voxelize(vox))
  map = treeMap(thin, map.hough(hmin = 0.25, hmax = 16, hstep = 0.5, pixel_size = 0.05, max_radius = rad, min_density = dens))
  tls = stemPoints(las, map)#classify stem points
  seg = stemSegmentation(tls, sgmt.ransac.circle(n))#extract measures
  cs <- crs(tls)
  thin <- NULL
  map <- NULL
  coordinates(seg) = cbind(seg$X, seg$Y)
  output <- writeOGR(seg, td, paste(tools::file_path_sans_ext(basename(lasfile)), "_stems", sep=""), driver="ESRI Shapefile", overwrite_layer=TRUE)
  return(output)
}

ptm <- proc.time()#START THE CLOCK
stemdetection.LAS(las, vox, dens, n, rad)
proc.time() - ptm#STOP THE CLOCK

# ptm <- proc.time()#START THE CLOCK
# 
# for (i in LASlist) {
#   stemdetection.LAS(readLAS(i), vox, dens, n, rad)
# }
# proc.time() - ptm#STOP THE CLOCK

stemdetection.LAScluster = function(las, vox, dens, n, rad)
 {
  las <- readLAS(las, select = 'xyzi')# Read the LAScluster
  if (is.empty(las)) return(NULL)              # Exit early (see documentation)
    
  thin = tlsSample(las, voxelize(vox))
  map = treeMap(thin, map.hough(hmin = 0.25, hmax = 16, hstep = 0.5, pixel_size = 0.05, max_radius = rad, min_density = dens))
  tls = stemPoints(las, map)#classify stem points
  seg = stemSegmentation(tls, sgmt.ransac.circle(n))#extract measures
  cs <- crs(tls)
  thin <- NULL; map <- NULL ; tls = NULL
  coordinates(seg) = cbind(seg$X, seg$Y)
  output <- writeOGR(seg, td, paste(tools::file_path_sans_ext(basename(ctg@data$File)), "_stems", sep=""), driver="ESRI Shapefile", overwrite_layer=TRUE)
  return(output)
}

stemdetection.LAScatalog = function(las, vox, dens, n, rad)
{
  catalog_apply(las, stemdetection, vox = vox, dens = dens, n = n, rad = rad)
}

stemdetection.LAScatalog = function(las, vox, dens, n, rad)
{
  catalog_apply(las, stemdetection.LAScluster, vox = vox, dens = dens, n = n, rad = rad)
}

# 2 chunks 2 threads for 6 cores total
plan(multisession, workers = 2L)
set_lidr_threads(2L)

ptm <- proc.time()#START THE CLOCK
stemdetection.LAScatalog(ctg, vox, dens, n, rad)
proc.time() - ptm#STOP THE CLOCK

